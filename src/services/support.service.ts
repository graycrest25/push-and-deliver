import {
  collection,
  query,
  orderBy,
  runTransaction,
  Timestamp,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  subscribePaginatedDocs,
  type PaginationOptions,
} from "@/lib/firestore-pagination";
import type { SupportTicket, TicketMessage } from "@/types";

const COLLECTION_NAME = "SupportTickets";
const MESSAGES_SUBCOLLECTION = "Messages";

export const supportService = {
  // Get all support tickets
  getSupportTickets: (
    callback: (tickets: SupportTicket[]) => void,
    pagination: PaginationOptions = {},
    onError: (error: Error) => void = console.error,
  ) => {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("updatedAt", "desc"),
    );

    return subscribePaginatedDocs(
      q,
      pagination,
      (snapshot) => {
        const tickets = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as SupportTicket[];
        callback(tickets);
      },
      onError,
    );
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
      orderBy("timestamp", "desc"),
    );

    return subscribePaginatedDocs(
      q,
      pagination,
      (snapshot) => {
        const messages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          timestamp: doc.data().timestamp?.toDate(),
        })) as TicketMessage[];
        callback(messages.reverse());
      },
      onError,
    );
  },

  // Append the message and update its preview atomically.
  sendSupportMessage: async (
    ticketId: string,
    userId: string,
    message: string,
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
        const ticket = await transaction.get(ticketRef);
        if (!ticket.exists() || ticket.data().status === "closed") {
          throw new Error("Closed tickets are read-only");
        }
        transaction.set(doc(messagesRef), payload);
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

  // Keep the ticket and its conversation; closing is an atomic status change.
  closeTicket: async (ticketId: string, userId: string, message: string) => {
    const ticketRef = doc(db, COLLECTION_NAME, ticketId);
    await runTransaction(db, async (transaction) => {
      const ticket = await transaction.get(ticketRef);
      if (!ticket.exists()) throw new Error("Ticket not found");
      if (ticket.data().status === "closed")
        throw new Error("Ticket is already closed");
      const now = Timestamp.fromDate(new Date());
      transaction.set(doc(collection(ticketRef, MESSAGES_SUBCOLLECTION)), {
        senderId: userId,
        message,
        createdAt: now,
        timestamp: now,
        imageurl: "",
      });
      transaction.update(ticketRef, {
        status: "closed",
        lastMessage: message,
        lastSender: userId,
        updatedAt: now,
      });
    });
  },
};
