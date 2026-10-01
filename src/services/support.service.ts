import {
  collection,
  query,
  orderBy,
  runTransaction,
  Timestamp,
  doc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribePaginatedDocs, type PaginationOptions } from "@/lib/firestore-pagination";
import type { SupportTicket, TicketMessage } from "@/types";

const COLLECTION_NAME = "SupportTickets";
const MESSAGES_SUBCOLLECTION = "Messages";

export const supportService = {
  // Get all support tickets
  getSupportTickets: (callback: (tickets: SupportTicket[]) => void, pagination: PaginationOptions = {}, onError: (error: Error) => void = console.error) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("updatedAt", "desc")
    );

    return subscribePaginatedDocs(q, pagination, (snapshot) => {
      const tickets = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as SupportTicket[];
      callback(tickets);
    }, onError);
  },

  // Get messages for a specific ticket
  getTicketMessages: (
    ticketId: string,
    callback: (messages: TicketMessage[]) => void,
    pagination: PaginationOptions = {},
    onError: (error: Error) => void = console.error,
  ) => {
    const q = query(
      collection(db, COLLECTION_NAME, ticketId, MESSAGES_SUBCOLLECTION),
      orderBy("timestamp", "desc")
    );

    return subscribePaginatedDocs(q, pagination, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        timestamp: doc.data().timestamp?.toDate(),
      })) as TicketMessage[];
      callback(messages.reverse());
    }, onError);
  },

  // Send a support message via Cloud Function
  sendSupportMessage: async (
    ticketId: string,
    userId: string,
    message: string
  ) => {
    try {
      const payload = {
        senderId: userId,
        message,
        createdAt: Timestamp.fromDate(new Date()),
        timestamp: Timestamp.fromDate(new Date()),
        imageurl: "",
        // type: buffer
      };
      await runTransaction(db, async (transaction) => {
        const ticketRef = doc(db, COLLECTION_NAME, ticketId);
        const messagesRef = collection(ticketRef, MESSAGES_SUBCOLLECTION);
        await addDoc(messagesRef, payload);
        transaction.update(ticketRef, {
          lastMessage: message,
          lastSender: userId,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      });
    } catch (error) {
      console.error("Error sending support message:", error);
      throw error;
    }
  },

  // Update ticket status
  updateTicketStatus: async (ticketId: string, status: "open" | "closed") => {
    try {
      const ticketRef = doc(db, COLLECTION_NAME, ticketId);
      await updateDoc(ticketRef, {
        status,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating ticket status:", error);
      throw error;
    }
  },
};
