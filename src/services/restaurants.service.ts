import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
// Restaurants Service - Read and Update (verify & block)
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
import type { Restaurant } from '@/types';
import { VerificationStatus } from '@/types';

const COLLECTION_NAME = 'Restaurants';

export const restaurantsService = {
  // Read all restaurants
  async getAllRestaurants(pagination: PaginationOptions = {}): Promise<Restaurant[]> {
    try {
      const querySnapshot = await getPaginatedDocs(collection(db, COLLECTION_NAME), pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Restaurant[];
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      throw error;
    }
  },

  // Read verified restaurants
  async getVerifiedRestaurants(pagination: PaginationOptions = {}): Promise<Restaurant[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('verificationStatus', '==', VerificationStatus.verified)
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Restaurant[];
    } catch (error) {
      console.error('Error fetching verified restaurants:', error);
      throw error;
    }
  },

  // Read pending verification restaurants
  async getPendingRestaurants(pagination: PaginationOptions = {}): Promise<Restaurant[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('verificationStatus', '==', VerificationStatus.unverified)
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Restaurant[];
    } catch (error) {
      console.error('Error fetching pending restaurants:', error);
      throw error;
    }
  },

  // Read blocked restaurants
  async getBlockedRestaurants(pagination: PaginationOptions = {}): Promise<Restaurant[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('verificationStatus', '==', VerificationStatus.blocked)
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Restaurant[];
    } catch (error) {
      console.error('Error fetching blocked restaurants:', error);
      throw error;
    }
  },

  // Read a single restaurant by ID
  async getRestaurantById(id: string): Promise<Restaurant | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as Restaurant;
      }

      return null;
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      throw error;
    }
  },

  // Verify a restaurant
  async verifyRestaurant(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        verificationStatus: VerificationStatus.verified,
      });
    } catch (error) {
      console.error('Error verifying restaurant:', error);
      throw error;
    }
  },

  // Block a restaurant
  async blockRestaurant(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        verificationStatus: VerificationStatus.blocked,
      });
    } catch (error) {
      console.error('Error blocking restaurant:', error);
      throw error;
    }
  },

  // Unblock a restaurant
  async unblockRestaurant(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        verificationStatus: VerificationStatus.verified,
      });
    } catch (error) {
      console.error('Error unblocking restaurant:', error);
      throw error;
    }
  },

  // Update restaurant information
  async updateRestaurant(id: string, restaurantData: Partial<Omit<Restaurant, 'id'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, restaurantData);
    } catch (error) {
      console.error('Error updating restaurant:', error);
      throw error;
    }
  },
};
