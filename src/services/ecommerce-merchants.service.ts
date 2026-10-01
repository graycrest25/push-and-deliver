import { getPaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
// E-commerce Merchants Service - Read and Update
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  EcommerceMerchant,
  Product,
  ProductVariant,
  Transaction,
} from "@/types";

const COLLECTION_NAME = "EcommerceMerchants";

export const ecommerceMerchantsService = {
  async getVariantForColor(merchantId: string, productId: string, color: string): Promise<ProductVariant | null> {
    const variants = collection(db, COLLECTION_NAME, merchantId, "Products", productId, "Variants");
    const snapshot = await getDocs(query(variants, where("colorList", "array-contains", color), limit(1)));
    const variant = snapshot.docs[0];
    return variant ? { id: variant.id, ...variant.data(), createdAt: variant.data().createdAt?.toDate?.() } as ProductVariant : null;
  },
  // Read all merchants
  async getAllMerchants(pagination: PaginationOptions = {}): Promise<EcommerceMerchant[]> {
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
        updatedAt: doc.data().updatedAt?.toDate?.(),
      })) as EcommerceMerchant[];
    } catch (error) {
      console.error("Error fetching merchants:", error);
      throw error;
    }
  },

  // Read verified merchants
  async getVerifiedMerchants(pagination: PaginationOptions = {}): Promise<EcommerceMerchant[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("verificationStatus", "==", 1),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        updatedAt: doc.data().updatedAt?.toDate?.(),
      })) as EcommerceMerchant[];
    } catch (error) {
      console.error("Error fetching verified merchants:", error);
      throw error;
    }
  },

  // Read unverified merchants
  async getUnverifiedMerchants(pagination: PaginationOptions = {}): Promise<EcommerceMerchant[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("verificationStatus", "==", 0),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
        updatedAt: doc.data().updatedAt?.toDate?.(),
      })) as EcommerceMerchant[];
    } catch (error) {
      console.error("Error fetching unverified merchants:", error);
      throw error;
    }
  },

  // Read a single merchant by ID
  async getMerchantById(id: string): Promise<EcommerceMerchant | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.(),
          updatedAt: docSnap.data().updatedAt?.toDate?.(),
        } as EcommerceMerchant;
      }

      return null;
    } catch (error) {
      console.error("Error fetching merchant:", error);
      throw error;
    }
  },

  // Update merchant information
  async updateMerchant(
    id: string,
    merchantData: Partial<Omit<EcommerceMerchant, "id" | "createdAt">>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...merchantData,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error updating merchant:", error);
      throw error;
    }
  },

  // Get merchant products
  async getMerchantProducts(merchantId: string, pagination: PaginationOptions = {}): Promise<Product[]> {
    try {
      const productsRef = collection(
        db,
        COLLECTION_NAME,
        merchantId,
        "Products"
      );
      const q = query(productsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
      })) as Product[];
    } catch (error) {
      console.error("Error fetching merchant products:", error);
      throw error;
    }
  },

  // Get single product by ID
  async getProductById(
    merchantId: string,
    productId: string
  ): Promise<Product | null> {
    try {
      const docRef = doc(
        db,
        COLLECTION_NAME,
        merchantId,
        "Products",
        productId
      );
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.(),
        } as Product;
      }

      return null;
    } catch (error) {
      console.error("Error fetching product:", error);
      throw error;
    }
  },

  // Get product variants
  async getProductVariants(
    merchantId: string,
    productId: string, pagination: PaginationOptions = {}
  ): Promise<ProductVariant[]> {
    try {
      const variantsRef = collection(
        db,
        COLLECTION_NAME,
        merchantId,
        "Products",
        productId,
        "Variants"
      );
      const q = query(variantsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.(),
      })) as ProductVariant[];
    } catch (error) {
      console.error("Error fetching product variants:", error);
      throw error;
    }
  },

  // Get merchant transactions
  async getMerchantTransactions(merchantId: string, pagination: PaginationOptions = {}): Promise<Transaction[]> {
    try {
      const transactionsRef = collection(
        db,
        COLLECTION_NAME,
        merchantId,
        "Transactions"
      );
      const q = query(transactionsRef, orderBy("time", "desc"));
      const querySnapshot = await getPaginatedDocs(q, pagination);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().time?.toDate?.(),
      })) as Transaction[];
    } catch (error) {
      console.error("Error fetching merchant transactions:", error);
      throw error;
    }
  },

  // Check if transactions exist for a merchant
  async checkTransactionsExist(merchantId: string): Promise<boolean> {
    try {
      const transactionsRef = collection(
        db,
        COLLECTION_NAME,
        merchantId,
        "Transactions"
      );
      const q = query(transactionsRef, limit(1));
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking transactions:", error);
      // Return false if there's an error (subcollection might not exist)
      return false;
    }
  },
};
