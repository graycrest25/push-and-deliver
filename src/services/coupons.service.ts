import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { endpoints } from "@/lib/endpoint";
import { auth, db } from "@/lib/firebase";
import type { Coupon } from "@/types";

export type CreateAdminCouponRequest = {
  percentageDiscount: number;
} & (
  | { canExpire?: false; expTime?: null }
  | { canExpire: true; expTime: "24hrs" | "48hrs" }
);

const COLLECTION_NAME = "Coupons";

export const couponsService = {
  async createCoupon(couponData: CreateAdminCouponRequest): Promise<void> {
    if (!Number.isInteger(couponData.percentageDiscount) ||
        couponData.percentageDiscount < 1 || couponData.percentageDiscount > 100) {
      throw new Error("Enter a whole-number percentage from 1 to 100.");
    }
    if (couponData.canExpire !== undefined && typeof couponData.canExpire !== "boolean") {
      throw new Error("Coupon expiry must be enabled or disabled.");
    }
    if (couponData.canExpire && !["24hrs", "48hrs"].includes(couponData.expTime ?? "")) {
      throw new Error("Choose a 24-hour or 48-hour expiry.");
    }
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Sign in to create coupons.");
    const token = await currentUser.getIdToken(true);
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.isAdmin !== true || !["super", "regular"].includes(String(claims.adminType))) {
      throw new Error("Super or regular admin access is required to create coupons.");
    }
    if (auth.currentUser?.uid !== currentUser.uid) {
      throw new Error("Your session changed. Please try again.");
    }
    const body = couponData.canExpire
      ? { percentageDiscount: couponData.percentageDiscount, canExpire: true, expTime: couponData.expTime }
      : { percentageDiscount: couponData.percentageDiscount };
    const response = await fetch(endpoints.createAdminCoupon, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success === false) {
      throw new Error(
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.message === "string" && data.message) ||
        "Failed to create coupon. Please try again.",
      );
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
