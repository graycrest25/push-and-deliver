import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GeneralNotification } from "@/types";

// Collection name with space as specified by the user
const COLLECTION_NAME = "General notifications";

export const generalNotificationsService = {
  // Create a new general notification
  async createNotification(
    notificationData: Omit<GeneralNotification, "id" | "createdAt">
  ): Promise<GeneralNotification> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...notificationData,
        createdAt: Timestamp.fromDate(now),
      });

      return {
        id: docRef.id,
        ...notificationData,
        createdAt: now,
      };
    } catch (error) {
      console.error("Error creating general notification:", error);
      throw error;
    }
  },

  // Read all general notifications
  async getAllNotifications(pagination: PaginationOptions = {}): Promise<GeneralNotification[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
      })) as GeneralNotification[];
    } catch (error) {
      console.error("Error fetching general notifications:", error);
      throw error;
    }
  },

  // Delete a notification
  async deleteNotification(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting general notification:", error);
      throw error;
    }
  },
};
