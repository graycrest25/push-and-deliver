import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppConfig } from "@/types";

const COLLECTION_NAME = "AppConfig";

export const appConfigService = {
  // Get all app configurations
  async getAllConfigs(pagination: PaginationOptions = {}): Promise<AppConfig[]> {
    try {
      const querySnapshot = await getPaginatedDocs(collection(db, COLLECTION_NAME), pagination);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AppConfig[];
    } catch (error) {
      console.error("Error fetching app configs:", error);
      throw error;
    }
  },

  // Get a specific config by document ID
  async getConfig(docId: string): Promise<AppConfig | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as AppConfig;
      }

      return null;
    } catch (error) {
      console.error("Error fetching app config:", error);
      throw error;
    }
  },

  // Update a specific field in a config document
  async updateField(
    docId: string,
    field: string,
    value: string | number | boolean
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, docId);
      await updateDoc(docRef, { [field]: value });
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      throw error;
    }
  },

  // Update multiple fields in a config document
  async updateConfig(
    docId: string,
    configData: Partial<AppConfig>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, docId);
      await updateDoc(docRef, configData);
    } catch (error) {
      console.error("Error updating app config:", error);
      throw error;
    }
  },
};
