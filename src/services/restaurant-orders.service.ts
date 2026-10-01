import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import { db } from "@/lib/firebase";
import type { RestaurantOrder } from "@/types";
import {
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

const COLLECTION_NAME = "RestaurantOrders";

export const restaurantOrdersService = {
  // Get all restaurant orders
  async getAllOrders(pagination: PaginationOptions = {}): Promise<RestaurantOrder[]> {
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
      })) as RestaurantOrder[];
    } catch (error) {
      console.error("Error fetching restaurant orders:", error);
      throw error;
    }
  },

  // Get a single order by ID
  async getOrderById(orderId: string): Promise<RestaurantOrder | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, orderId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
        } as RestaurantOrder;
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
};
