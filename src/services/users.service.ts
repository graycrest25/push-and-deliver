import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
// Users Service - Read only
import {
  collection,
  doc,
  getDocs,
  getCountFromServer,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "@/types";

const COLLECTION_NAME = "Users";

export const usersService = {
  // Read all users
  async getAllUsers(pagination: PaginationOptions = {}): Promise<User[]> {
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
        updatedAt: doc.data().updatedAt?.toDate?.(),
      })) as User[];
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  },

  // Read a single user by ID
  async getUserById(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.(),
          updatedAt: docSnap.data().updatedAt?.toDate?.(),
        } as User;
      }

      return null;
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  },

  // Get total user count
  async getTotalUserCount(): Promise<number> {
    try {
      const querySnapshot = await getCountFromServer(collection(db, COLLECTION_NAME));
      return querySnapshot.data().count;
    } catch (error) {
      console.error("Error fetching user count:", error);
      throw error;
    }
  },

  // Get recent users
  async getRecentUsers(pagination: PaginationOptions = {}): Promise<User[]> {
    return this.getAllUsers(pagination);
  },

  // Get users with referrals
  async getUsersWithReferrals(pagination: PaginationOptions = {}): Promise<User[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("referralsCount", ">", 0),
        orderBy("referralsCount", "desc")
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        updatedAt: doc.data().updatedAt?.toDate?.(),
      })) as User[];
    } catch (error) {
      console.error("Error fetching users with referrals:", error);
      throw error;
    }
  },

  // Get user by email
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("email", "==", email),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.(),
          updatedAt: docSnap.data().updatedAt?.toDate?.(),
        } as User;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user by email:", error);
      throw error;
    }
  },

  // Update user
  async updateUser(id: string, data: Partial<User>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  },
};
