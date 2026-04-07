import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type GeneratedReferral = {
  id: string;
  name?: string;
  shortUrl?: string;
  referralsCount?: number;
  createdAt?: Date;
  expirationDate?: Date;
  updatedAt?: Date;
};

const COLLECTION_NAME = "GeneratedReferrals";

export const generatedReferralsService = {
  async getAllGeneratedReferrals(): Promise<GeneratedReferral[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        expirationDate: doc.data().expirationDate?.toDate?.(),
        updatedAt: doc.data().updatedAt?.toDate?.(),
      })) as GeneratedReferral[];
    } catch (error) {
      console.error("Error fetching generated referrals:", error);
      throw error;
    }
  },
  async deleteReferral(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting referral:", error);
    throw error;
  }
}
};