// Analytics Service - Dashboard metrics and statistics
import {
  collection,
  getCountFromServer,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VerificationStatus, WithdrawalStatus } from '@/types';

export const analyticsService = {
  // Get total counts for all entities
  async getTotalCounts(): Promise<{
    totalUsers: number;
    totalRiders: number;
    totalRestaurants: number;
    totalFees: number;
    totalReferrals: number;
    totalWithdrawals: number;
  }> {
    try {
      const [users, riders, restaurants, fees, referrals, withdrawals] = await Promise.all([
        getCountFromServer(collection(db, 'Users')),
        getCountFromServer(collection(db, 'Riders')),
        getCountFromServer(collection(db, 'Restaurants')),
        getCountFromServer(collection(db, 'Fees')),
        getCountFromServer(collection(db, 'Referrals')),
        getCountFromServer(collection(db, 'Withdrawals')),
      ]);

      return {
        totalUsers: users.data().count,
        totalRiders: riders.data().count,
        totalRestaurants: restaurants.data().count,
        totalFees: fees.data().count,
        totalReferrals: referrals.data().count,
        totalWithdrawals: withdrawals.data().count,
      };
    } catch (error) {
      console.error('Error fetching total counts:', error);
      throw error;
    }
  },

  // Get verified counts
  async getVerifiedCounts(): Promise<{
    verifiedRiders: number;
    verifiedRestaurants: number;
  }> {
    try {
      const [riders, restaurants] = await Promise.all([
        getCountFromServer(query(collection(db, 'Riders'), where('verificationStatus', '==', VerificationStatus.verified))),
        getCountFromServer(query(collection(db, 'Restaurants'), where('verificationStatus', '==', VerificationStatus.verified))),
      ]);

      return {
        verifiedRiders: riders.data().count,
        verifiedRestaurants: restaurants.data().count,
      };
    } catch (error) {
      console.error('Error fetching verified counts:', error);
      throw error;
    }
  },

  // Get pending verification counts
  async getPendingCounts(): Promise<{
    pendingRiders: number;
    pendingRestaurants: number;
  }> {
    try {
      const [riders, restaurants] = await Promise.all([
        getCountFromServer(query(collection(db, 'Riders'), where('verificationStatus', '==', VerificationStatus.unverified))),
        getCountFromServer(query(collection(db, 'Restaurants'), where('verificationStatus', '==', VerificationStatus.unverified))),
      ]);

      return {
        pendingRiders: riders.data().count,
        pendingRestaurants: restaurants.data().count,
      };
    } catch (error) {
      console.error('Error fetching pending counts:', error);
      throw error;
    }
  },

  // Get blocked counts
  async getBlockedCounts(): Promise<{
    blockedRiders: number;
    blockedRestaurants: number;
  }> {
    try {
      const [riders, restaurants] = await Promise.all([
        getCountFromServer(query(collection(db, 'Riders'), where('verificationStatus', '==', VerificationStatus.blocked))),
        getCountFromServer(query(collection(db, 'Restaurants'), where('verificationStatus', '==', VerificationStatus.blocked))),
      ]);

      return {
        blockedRiders: riders.data().count,
        blockedRestaurants: restaurants.data().count,
      };
    } catch (error) {
      console.error('Error fetching blocked counts:', error);
      throw error;
    }
  },

  // Get referral statistics
  async getReferralStats(): Promise<{
    totalReferrals: number;
  }> {
    try {
      const all = await getCountFromServer(collection(db, 'Referrals'));

      return {
        totalReferrals: all.data().count,
      };
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      throw error;
    }
  },

  // Get withdrawal statistics
  async getWithdrawalStats(): Promise<{
    totalWithdrawals: number;
    successfulWithdrawals: number;
    pendingWithdrawals: number;
    failedWithdrawals: number;
    reversedWithdrawals: number;
  }> {
    try {
      const [all, successful, pending, failed, reversed] = await Promise.all([
        getCountFromServer(collection(db, 'Withdrawals')),
        getCountFromServer(query(collection(db, 'Withdrawals'), where('status', '==', WithdrawalStatus.Successful))),
        getCountFromServer(query(collection(db, 'Withdrawals'), where('status', '==', WithdrawalStatus.Pending))),
        getCountFromServer(query(collection(db, 'Withdrawals'), where('status', '==', WithdrawalStatus.Failed))),
        getCountFromServer(query(collection(db, 'Withdrawals'), where('status', '==', WithdrawalStatus.Reversed))),
      ]);

      return {
        totalWithdrawals: all.data().count,
        successfulWithdrawals: successful.data().count,
        pendingWithdrawals: pending.data().count,
        failedWithdrawals: failed.data().count,
        reversedWithdrawals: reversed.data().count,
      };
    } catch (error) {
      console.error('Error fetching withdrawal stats:', error);
      throw error;
    }
  },

  // Get new registrations in last N days
  async getNewRegistrations(days: number = 7): Promise<{
    newUsers: number;
    newRiders: number;
    newRestaurants: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      const [users, riders, restaurants] = await Promise.all([
        getCountFromServer(query(collection(db, 'Users'), where('createdAt', '>=', cutoffTimestamp))),
        getCountFromServer(query(collection(db, 'Riders'), where('createdAt', '>=', cutoffTimestamp))),
        getCountFromServer(query(collection(db, 'Restaurants'), where('createdAt', '>=', cutoffTimestamp))),
      ]);

      return {
        newUsers: users.data().count,
        newRiders: riders.data().count,
        newRestaurants: restaurants.data().count,
      };
    } catch (error) {
      console.error('Error fetching new registrations:', error);
      throw error;
    }
  },

  // Get online riders count
  async getOnlineRidersCount(): Promise<number> {
    try {
      const querySnapshot = await getCountFromServer(
        query(collection(db, 'Riders'), where('onlineStatus', '==', true))
      );
      return querySnapshot.data().count;
    } catch (error) {
      console.error('Error fetching online riders count:', error);
      throw error;
    }
  },

  // Get open restaurants count
  async getOpenRestaurantsCount(): Promise<number> {
    try {
      const querySnapshot = await getCountFromServer(
        query(collection(db, 'Restaurants'), where('isOpen', '==', true))
      );
      return querySnapshot.data().count;
    } catch (error) {
      console.error('Error fetching open restaurants count:', error);
      throw error;
    }
  },
};
