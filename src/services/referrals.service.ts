import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
// Referrals Service - Read only
import {
  collection,
  getDoc,
  doc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCountFromServer } from "firebase/firestore";
import type { Referral } from '@/types';

const COLLECTION_NAME = 'Referrals';

export const referralsService = {
  async getReferralCountByReferrerId(referrerId: string): Promise<number> {
    const result = await getCountFromServer(query(collection(db, COLLECTION_NAME), where("referrerUid", "==", referrerId)));
    return result.data().count;
  },
  // Read all referrals
  async getAllReferrals(pagination: PaginationOptions = {}): Promise<Referral[]> {
    try {
      const querySnapshot = await getPaginatedDocs(collection(db, COLLECTION_NAME), pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        completedAt: doc.data().completedAt?.toDate?.(),
      })) as Referral[];
    } catch (error) {
      console.error('Error fetching referrals:', error);
      throw error;
    }
  },

  // Read referrals by referrer ID
  async getReferralsByReferrerId(referrerId: string, pagination: PaginationOptions = {}): Promise<Referral[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('referrerId', '==', referrerId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as Referral[];
    } catch (error) {
      console.error('Error fetching referrals by referrer:', error);
      throw error;
    }
  },

  // Read referrals by referred ID
  async getReferralsByReferredId(referredId: string, pagination: PaginationOptions = {}): Promise<Referral[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('referredId', '==', referredId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as Referral[];
    } catch (error) {
      console.error('Error fetching referrals by referred:', error);
      throw error;
    }
  },

  // Read referrals by status
  async getReferralsByStatus(status: 'pending' | 'completed' | 'expired', pagination: PaginationOptions = {}): Promise<Referral[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as Referral[];
    } catch (error) {
      console.error('Error fetching referrals by status:', error);
      throw error;
    }
  },

  // Read a single referral by ID
  async getReferralById(id: string): Promise<Referral | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          completedAt: docSnap.data().completedAt?.toDate(),
        } as Referral;
      }

      return null;
    } catch (error) {
      console.error('Error fetching referral:', error);
      throw error;
    }
  },

  // Get total referral count
  async getTotalReferralCount(): Promise<number> {
    try {
      const querySnapshot = await getCountFromServer(collection(db, COLLECTION_NAME));
      return querySnapshot.data().count;
    } catch (error) {
      console.error('Error fetching referral count:', error);
      throw error;
    }
  },
};
