import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Coupon } from "@/types";

const COLLECTION_NAME = "Coupons";

export const couponsService = {
  // Create a new coupon
  async createCoupon(
    couponData: Omit<Coupon, "id" | "createdAt">
  ): Promise<Coupon> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...couponData,
        createdAt: Timestamp.fromDate(now),
      });

      return {
        id: docRef.id,
        ...couponData,
        createdAt: now,
      };
    } catch (error) {
      console.error("Error creating coupon:", error);
      throw error;
    }
  },

  // Read all coupons
  async getAllCoupons(pagination: PaginationOptions = {}): Promise<Coupon[]> {
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
      })) as Coupon[];
    } catch (error) {
      console.error("Error fetching coupons:", error);
      throw error;
    }
  },

  // Read active coupons only
  async getActiveCoupons(pagination: PaginationOptions = {}): Promise<Coupon[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("isActive", "==", true),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Coupon[];
    } catch (error) {
      console.error("Error fetching active coupons:", error);
      throw error;
    }
  },

  // Read a single coupon by ID
  async getCouponById(id: string): Promise<Coupon | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
        } as Coupon;
      }

      return null;
    } catch (error) {
      console.error("Error fetching coupon:", error);
      throw error;
    }
  },

  // Update a coupon
  async updateCoupon(
    id: string,
    couponData: Partial<Omit<Coupon, "id" | "createdAt">>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...couponData,
      });
    } catch (error) {
      console.error("Error updating coupon:", error);
      throw error;
    }
  },

  // Delete a coupon
  async deleteCoupon(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting coupon:", error);
      throw error;
    }
  },

  // Toggle coupon status
  async toggleCouponStatus(id: string, isActive: boolean): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        isActive,
      });
    } catch (error) {
      console.error("Error toggling coupon status:", error);
      throw error;
    }
  },
};
