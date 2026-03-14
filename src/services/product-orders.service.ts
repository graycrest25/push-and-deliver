import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ProductOrder } from "@/types";

const COLLECTION_NAME = "ProductOrders";

export const productOrdersService = {
  // Get all unpaid orders
  async getAllOrders(): Promise<ProductOrder[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        // where("ispaid", "==", false),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        statusTimeline: doc.data().statusTimeline?.map((item: any) => ({
          ...item,
          timestamp: item.timestamp?.toDate?.(),
        })),
      })) as ProductOrder[];
    } catch (error) {
      console.error("Error fetching product orders:", error);
      throw error;
    }
  },

  // Get order by ID
  async getOrderById(orderId: string): Promise<ProductOrder | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, orderId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.(),
          statusTimeline: docSnap.data().statusTimeline?.map((item: any) => ({
            ...item,
            timestamp: item.timestamp?.toDate?.(),
          })),
        } as ProductOrder;
      }

      return null;
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  },

  // Get unpaid orders by status
  async getOrdersByStatus(status: number): Promise<ProductOrder[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("ispaid", "==", false),
        where("orderstatus", "==", status),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        statusTimeline: doc.data().statusTimeline?.map((item: any) => ({
          ...item,
          timestamp: item.timestamp?.toDate?.(),
        })),
      })) as ProductOrder[];
    } catch (error) {
      console.error("Error fetching orders by status:", error);
      throw error;
    }
  },

  // Update order status
  async updateOrderStatus(orderId: string, status: number): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, orderId);
      await updateDoc(docRef, {
        orderstatus: status,
      });
    } catch (error) {
      console.error("Error updating order status:", error);
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
};
