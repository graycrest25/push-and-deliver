import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
// Withdrawals Service - Read and Update status
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Withdrawal } from '@/types';
import { WithdrawalStatus } from '@/types';

const COLLECTION_NAME = 'Withdrawals';

export const withdrawalsService = {
  // Read all withdrawals
  async getAllWithdrawals(pagination: PaginationOptions = {}): Promise<Withdrawal[]> {
    try {
      const querySnapshot = await getPaginatedDocs(collection(db, COLLECTION_NAME), pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
      })) as Withdrawal[];
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      throw error;
    }
  },

  // Read withdrawals by status
  async getWithdrawalsByStatus(status: WithdrawalStatus, pagination: PaginationOptions = {}): Promise<Withdrawal[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', status)
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
      })) as Withdrawal[];
    } catch (error) {
      console.error('Error fetching withdrawals by status:', error);
      throw error;
    }
  },

  // Read pending withdrawals
  async getPendingWithdrawals(pagination: PaginationOptions = {}): Promise<Withdrawal[]> {
    return this.getWithdrawalsByStatus(WithdrawalStatus.Pending, pagination);
  },

  // Read withdrawals by user type
  async getWithdrawalsByUserType(userType: string, pagination: PaginationOptions = {}): Promise<Withdrawal[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userType', '==', userType)
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
      })) as Withdrawal[];
    } catch (error) {
      console.error('Error fetching withdrawals by user type:', error);
      throw error;
    }
  },

  // Read a single withdrawal by ID
  async getWithdrawalById(id: string): Promise<Withdrawal | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.(),
        } as Withdrawal;
      }

      return null;
    } catch (error) {
      console.error('Error fetching withdrawal:', error);
      throw error;
    }
  },

  // Update withdrawal status
  async updateWithdrawalStatus(id: string, status: WithdrawalStatus): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error updating withdrawal status:', error);
      throw error;
    }
  },

  // Approve withdrawal
  async approveWithdrawal(id: string): Promise<void> {
    return this.updateWithdrawalStatus(id, WithdrawalStatus.Successful);
  },

  // Reject withdrawal
  async rejectWithdrawal(id: string): Promise<void> {
    return this.updateWithdrawalStatus(id, WithdrawalStatus.Failed);
  },

  // Reverse withdrawal
  async reverseWithdrawal(id: string): Promise<void> {
    return this.updateWithdrawalStatus(id, WithdrawalStatus.Reversed);
  },
};
