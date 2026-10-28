import { requireSuperAdmin } from "@/lib/require-super-admin";
import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import { auth, db } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";
import { isDevelopmentMode } from "@/lib/environment";
import type { ShipmentOrder } from "@/types";
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

const COLLECTION_NAME = "ShippmentOrders";

export type AdminShipmentStatus =
  | "AcceptedByRider"
  | "SentToHq"
  | "OnrouteToDestination"
  | "DeliveredToDestination"
  | "Cancelled";

export interface ShipmentStatusResult {
  success: true;
  orderId: string;
  orderStatus: number;
  statusName: AdminShipmentStatus;
  riderLocationUpdateDocID: string | null;
}

export class ShipmentStatusError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ShipmentStatusError";
    this.status = status;
    this.code = code;
  }
}

export const shipmentOrdersService = {
  subscribeToOrder(
    orderId: string,
    onOrder: (order: ShipmentOrder | null) => void,
    onError: (error: Error) => void,
  ) {
    return onSnapshot(doc(db, COLLECTION_NAME, orderId), (snapshot) => {
      const data = snapshot.data();
      onOrder(data ? {
        ...data,
        id: snapshot.id,
        createdAt: data.createdAt?.toDate(),
        cancelledAt: data.cancelledAt?.toDate(),
        completedAt: data.completedAt?.toDate(),
      } as ShipmentOrder : null);
    }, onError);
  },
  async resolveShipmentFee(input: {
    orderId: string;
    amount: number;
    reference: string;
    newweightinKG?: number;
  }): Promise<{ success: true; authurl: string; reference: string }> {
    if (!input.orderId.trim()) throw new Error("A shipment document ID is required");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Enter an additional fee greater than zero");
    }
    if (!/^[A-Za-z0-9._=-]+$/.test(input.reference)) {
      throw new Error("Reference may only contain letters, numbers, ., _, =, or -");
    }
    if (input.newweightinKG !== undefined &&
        (!Number.isFinite(input.newweightinKG) || input.newweightinKG <= 0)) {
      throw new Error("Enter a final weight greater than zero or leave it blank");
    }
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Sign in to resolve a shipment fee");
    const idToken = await currentUser.getIdToken(true);
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.isAdmin !== true || (claims.adminType !== "super" && claims.adminType !== "regular")) {
      throw new Error("Super or regular admin access is required");
    }
    const shipment = await getDoc(doc(db, COLLECTION_NAME, input.orderId));
    if (!shipment.exists()) throw new Error("Shipment not found");
    const email = shipment.data().senderemailaddress;
    if (typeof email !== "string" || !email.trim()) {
      throw new Error("This shipment has no sender email address");
    }
    const response = await fetch(endpoints.resloveShipmentFee, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: input.amount,
        reference: input.reference,
        metadata: {
          orderID: shipment.id,
          orderType: "shipmentoder",
          ...(input.newweightinKG !== undefined ? { newweightinKG: input.newweightinKG } : {}),
        },
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true) {
      throw new Error(typeof data?.error === "string" ? data.error : "Failed to resolve shipment fee");
    }
    if (typeof data.authurl !== "string" || !data.authurl.trim() ||
        data.reference !== input.reference) {
      throw new Error("The server returned an invalid shipment fee response");
    }
    return { success: true, authurl: data.authurl, reference: data.reference };
  },
  // Get all shipment orders
  async getAllOrders(pagination: PaginationOptions = {}, headOfficeId?: string): Promise<ShipmentOrder[]> {
    if (headOfficeId) await requireSuperAdmin();
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        ...(headOfficeId ? [where("pndofficelocationID", "==", headOfficeId)] : []),
        ...(pagination.search?.term.trim() ? [] : [orderBy("createdAt", "desc")])
      );
      const snapshot = await getPaginatedDocs(q, pagination);

      return snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate(),
        cancelledAt: doc.data().cancelledAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as ShipmentOrder[];
    } catch (error) {
      console.error("Error fetching shipment orders:", error);
      throw error;
    }
  },

  // Get a single order by ID
  async getOrderById(orderId: string): Promise<ShipmentOrder | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, orderId);
      const docSnap = await getDocFromServer(docRef);

      if (docSnap.exists()) {
        return {
          ...docSnap.data(),
          id: docSnap.id,
          createdAt: docSnap.data().createdAt?.toDate(),
          cancelledAt: docSnap.data().cancelledAt?.toDate(),
          completedAt: docSnap.data().completedAt?.toDate(),
        } as ShipmentOrder;
      }
      return null;
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  },

  // Update payment status
  async updatePaymentStatus(orderId: string, isPaid: boolean): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, orderId);
      await updateDoc(docRef, {
        ispaid: isPaid,
      });
    } catch (error) {
      console.error("Error updating payment status:", error);
      throw error;
    }
  },

  // Update order status
  async updateOrderStatus(orderId: string, orderStatus: AdminShipmentStatus, riderID?: string): Promise<ShipmentStatusResult> {
    if (!orderId.trim() || orderId.includes("/")) {
      throw new ShipmentStatusError(400, "invalid-argument", "A shipment document ID is required");
    }
    const acceptingRider = orderStatus === "AcceptedByRider";
    if (acceptingRider ? !isDevelopmentMode : !["SentToHq", "OnrouteToDestination", "DeliveredToDestination", "Cancelled"].includes(orderStatus)) {
      throw new ShipmentStatusError(400, "invalid-argument", "Unsupported admin shipment status");
    }
    if (acceptingRider && (!riderID?.trim() || riderID.includes("/"))) {
      throw new ShipmentStatusError(400, "invalid-argument", "Enter the rider's Firebase user ID");
    }
    if (!acceptingRider && riderID !== undefined) {
      throw new ShipmentStatusError(400, "invalid-argument", "Rider ID is only allowed when accepting a shipment");
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new ShipmentStatusError(401, "unauthenticated", "Sign in to update shipment status");
    }
    const send = async (forceRefresh: boolean) => {
      const idToken = await currentUser.getIdToken(forceRefresh);
      return fetch(endpoints.updateAdminShipmentOrderStatus, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, orderStatus, ...(acceptingRider ? { riderID: riderID!.trim() } : {}) }),
      });
    };
    let response = await send(false);
    if (response.status === 401) response = await send(true);
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true) {
      throw new ShipmentStatusError(
        response.status,
        typeof data?.code === "string" ? data.code : "unknown",
        typeof data?.error === "string" ? data.error : "Unable to update shipment status. Refresh the shipment before retrying.",
      );
    }
    return data as ShipmentStatusResult;
  },
};
