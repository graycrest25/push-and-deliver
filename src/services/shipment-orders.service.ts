import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import { db } from "@/lib/firebase";
import type { ShipmentOrder } from "@/types";
import {
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

const COLLECTION_NAME = "ShippmentOrders";

export const shipmentOrdersService = {
  // Get all shipment orders
  async getAllOrders(pagination: PaginationOptions = {}): Promise<ShipmentOrder[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getPaginatedDocs(q, pagination);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
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
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
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
  async updateOrderStatus(orderId: string, status: number): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, orderId);
      await updateDoc(docRef, {
        orderStatus: status,
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  },
};
