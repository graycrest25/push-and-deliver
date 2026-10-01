import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
// Notifications Service - Full CRUD operations
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
import type { Notification } from '@/types';

const COLLECTION_NAME = 'notifications';

export const notificationsService = {
  // Create a new notification
  async createNotification(notificationData: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...notificationData,
        scheduledFor: notificationData.scheduledFor ? Timestamp.fromDate(notificationData.scheduledFor) : null,
        sentAt: notificationData.sentAt ? Timestamp.fromDate(notificationData.sentAt) : null,
        createdAt: Timestamp.fromDate(now),
      });

      const newNotification: Notification = {
        id: docRef.id,
        ...notificationData,
        createdAt: now,
      };

      return newNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  // Read all notifications
  async getAllNotifications(pagination: PaginationOptions = {}): Promise<Notification[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      })) as Notification[];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  },

  // Read notifications by status
  async getNotificationsByStatus(status: 'draft' | 'scheduled' | 'sent', pagination: PaginationOptions = {}): Promise<Notification[]> {
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
        scheduledFor: doc.data().scheduledFor?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      })) as Notification[];
    } catch (error) {
      console.error('Error fetching notifications by status:', error);
      throw error;
    }
  },

  // Read notifications by target audience
  async getNotificationsByAudience(targetAudience: 'all' | 'users' | 'riders' | 'vendors', pagination: PaginationOptions = {}): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('targetAudience', '==', targetAudience),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        scheduledFor: doc.data().scheduledFor?.toDate(),
        sentAt: doc.data().sentAt?.toDate(),
      })) as Notification[];
    } catch (error) {
      console.error('Error fetching notifications by audience:', error);
      throw error;
    }
  },

  // Read a single notification by ID
  async getNotificationById(id: string): Promise<Notification | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          scheduledFor: docSnap.data().scheduledFor?.toDate(),
          sentAt: docSnap.data().sentAt?.toDate(),
        } as Notification;
      }

      return null;
    } catch (error) {
      console.error('Error fetching notification:', error);
      throw error;
    }
  },

  // Update a notification
  async updateNotification(
    id: string,
    notificationData: Partial<Omit<Notification, 'id' | 'createdAt'>>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData: any = { ...notificationData };

      if (notificationData.scheduledFor) {
        updateData.scheduledFor = Timestamp.fromDate(notificationData.scheduledFor);
      }
      if (notificationData.sentAt) {
        updateData.sentAt = Timestamp.fromDate(notificationData.sentAt);
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating notification:', error);
      throw error;
    }
  },

  // Delete a notification
  async deleteNotification(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  // Mark notification as sent
  async markAsSent(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        status: 'sent',
        sentAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error marking notification as sent:', error);
      throw error;
    }
  },
};
