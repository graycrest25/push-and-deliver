import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
// Fees Service - Full CRUD operations
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
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Fee } from '@/types';

const COLLECTION_NAME = 'Fees';

export const feesService = {
  // Create a new fee
  async createFee(feeData: Omit<Fee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Fee> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...feeData,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

      const newFee = {
        id: docRef.id,
        ...feeData,
        createdAt: now,
        updatedAt: now,
      } as Fee;

      return newFee;
    } catch (error) {
      console.error('Error creating fee:', error);
      throw error;
    }
  },

  // Read all fees
  async getAllFees(pagination: PaginationOptions = {}): Promise<Fee[]> {
    try {
      const querySnapshot = await getPaginatedDocs(collection(db, COLLECTION_NAME), pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        updatedAt: doc.data().updatedAt?.toDate?.(),
      })) as Fee[];
    } catch (error) {
      console.error('Error fetching fees:', error);
      throw error;
    }
  },

  // Read active fees only
  async getActiveFees(pagination: PaginationOptions = {}): Promise<Fee[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Fee[];
    } catch (error) {
      console.error('Error fetching active fees:', error);
      throw error;
    }
  },

  // Read a single fee by ID
  async getFeeById(id: string): Promise<Fee | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          updatedAt: docSnap.data().updatedAt?.toDate(),
        } as Fee;
      }

      return null;
    } catch (error) {
      console.error('Error fetching fee:', error);
      throw error;
    }
  },

  // Update a fee
  async updateFee(id: string, feeData: Partial<Omit<Fee, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...feeData,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error updating fee:', error);
      throw error;
    }
  },

  // Delete a fee
  async deleteFee(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting fee:', error);
      throw error;
    }
  },
};
