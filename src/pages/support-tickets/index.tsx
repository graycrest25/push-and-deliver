import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supportService } from "@/services/support.service";
import type { SupportTicket, TicketMessage } from "@/types";
import { format, isToday, isYesterday } from "date-fns";
import { Send, User as UserIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/contexts/UserContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconInfoCircle } from "@tabler/icons-react";

// Helper function to format time WhatsApp-style
const formatWhatsAppTime = (date: Date) => {
  if (isToday(date)) {
    return format(date, "h:mm a");
  } else if (isYesterday(date)) {
    return "Yesterday";
  } else {
    return format(date, "dd/MM/yy");
  }
};

export default function SupportTicketsPage() {
  const ticketPagination = useFirestorePagination();
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const { user } = useCurrentUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null
  );
  const messagePagination = useFirestorePagination(selectedTicket?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to tickets
  useEffect(() => {
    setLoadingTickets(true);
    const unsubscribe = supportService.getSupportTickets((data) => {
      setTickets(data);
      setLoadingTickets(false);
    }, ticketPagination.options, (error) => {
      setLoadingTickets(false);
      toast.error(error.message);
    });
    return () => unsubscribe();
  }, [ticketPagination.options]);

  // Subscribe to messages when a ticket is selected
  useEffect(() => {
    if (!selectedTicket?.id) return;

    setLoadingMessages(true);
    const unsubscribe = supportService.getTicketMessages(
      selectedTicket.id,
      (data) => {
        setMessages(data);
        setLoadingMessages(false);
        // Scroll to bottom on new messages
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      },
      messagePagination.options,
      (error) => { setLoadingMessages(false); toast.error(error.message); },
    );
    return () => unsubscribe();
  }, [selectedTicket?.id, messagePagination.options]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket?.id || !user?.id) return;

    try {
      setSending(true);
      await supportService.sendSupportMessage(
        selectedTicket.id,
        user.id,
        newMessage
      );
      setNewMessage("");
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleStatusToggle = async (checked: boolean) => {
    if (!selectedTicket?.id || !user?.id) return;

    const newStatus = checked ? "closed" : "open";

    // Prevent reopening closed tickets
    if (selectedTicket.status === "closed" && newStatus === "open") {
      toast.error("Closed tickets cannot be reopened");
      return;
    }

    try {
      setUpdatingStatus(true);
      await supportService.updateTicketStatus(selectedTicket.id, newStatus);

      if (newStatus === "closed") {
        // Send closing message to user
        const closingMessage =
          newMessage.trim() ||
          "This ticket is now closed, I hope all your issues have been resolved. If you have any other issues, please open a new ticket.";

        await supportService.sendSupportMessage(
          selectedTicket.id,
          user.id,
          closingMessage
        );

        toast.success("Ticket closed");

        // Clear the message input and close the ticket view after 1.5 seconds
        setTimeout(() => {
          setSelectedTicket(null);
          setNewMessage("");
        }, 1500);
      } else {
        toast.success("Ticket reopened");
      }

      // Update local state
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    } catch (error) {
      toast.error("Failed to update ticket status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="flex h-[85vh] overflow-hidden rounded-lg border bg-background shadow-sm">
      {/* Left Sidebar - Ticket List */}
      <div className="w-1/3 border-r flex flex-col min-w-[300px]">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold text-lg">Support Tickets</h2>
        </div>
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => {
                  if (ticket.status === "closed") {
                    toast.error("This ticket is closed and cannot be opened");
                    return;
                  }
                  setSelectedTicket(ticket);
                }}
                className={cn(
                  "flex flex-col gap-1 p-4 text-left transition-colors border-b",
                  ticket.status === "closed"
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-muted/50",
                  selectedTicket?.id === ticket.id && "bg-muted"
                )}
                disabled={ticket.status === "closed"}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-xs font-medium truncate max-w-[50%] text-muted-foreground">
                    {ticket.id}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {ticket.updatedAt
                      ? formatWhatsAppTime(new Date(ticket.updatedAt as Date))
                      : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between w-full mt-1">
                  <span className="text-sm text-foreground/90 font-medium w-1/3 truncate">
                    {ticket.lastMessage || "No messages"}
                  </span>
                </div>
              </button>
            ))}
            {tickets.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No tickets found
              </div>
            )}
          </div>
        </ScrollArea>
        <TablePagination pagination={ticketPagination} loading={loadingTickets} />
      </div>

      {/* Right Main Area - Chat Interface with Grid Layout */}
      <div className="flex-1 bg-muted/10 overflow-hidden">
        {selectedTicket ? (
          <div className="h-full grid grid-rows-[auto_1fr_auto]">
            {/* Chat Header - Fixed */}
            <div className="p-4 border-b bg-background flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    <UserIcon className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm">
                    Ticket #{selectedTicket.id}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    User ID: {selectedTicket.userId}
                  </p>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger>
                    <IconInfoCircle size={12} />
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>
                      Close ticket (On closing a ticket, it cannot be reopened.)
                    </p>
                  </TooltipContent>
                </Tooltip>
                <Label htmlFor="ticket-status" className="text-sm">
                  {selectedTicket.status === "closed" ? "Closed" : "Open"}
                </Label>
                <Switch
                  id="ticket-status"
                  checked={selectedTicket.status === "closed"}
                  onCheckedChange={handleStatusToggle}
                  disabled={
                    updatingStatus || selectedTicket.status === "closed"
                  }
                />
              </div>
            </div>

            {/* Messages Area - Scrollable */}
            <ScrollArea className="px-4 overflow-y-auto">
              <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                <TablePagination pagination={messagePagination} loading={loadingMessages} />
                {messages.map((msg, index) => {
                  const isUser = msg.senderId === selectedTicket.userId;
                  const isFirst = index === 0;
                  const isLast = index === messages.length - 1;

                  return (
                    <div
                      key={msg.id || index}
                      className={cn(
                        "flex w-fit max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                        !isUser
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted",
                        isFirst && "mt-4",
                        isLast && "mb-4"
                      )}
                    >
                      {msg.imageurl ? (
                        <img
                          src={msg.imageurl}
                          alt="attachment"
                          className="rounded-md max-w-full max-h-[400px] w-auto object-contain bg-black/5"
                        />
                      ) : null}
                      {msg.message && <p>{msg.message}</p>}
                      <span
                        className={cn(
                          "text-[10px] opacity-70",
                          !isUser
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {msg.timestamp
                          ? format(new Date(msg.timestamp as Date), "h:mm a")
                          : ""}
                      </span>
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input Area - Fixed */}
            <div className="p-4 bg-background border-t">
              <form
                ref={formRef}
                onSubmit={handleSendMessage}
                className="flex gap-2 max-w-3xl mx-auto"
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !newMessage.trim()}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/5">
            <div className="text-center">
              <div className="flex justify-center items-center">
                <svg
                  width="100"
                  height="100"
                  viewBox="0 0 75 80"
                  fill="#262626"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke-width="1px"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M72.9932 9.56226V67.1621L52.9932 77.1621V19.5623L72.9932 9.56226Z"
                    stroke="#E0E0E0"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M52.9934 19.5622V77.162L2.7832 48.1821C2.7832 32.1021 7.65329 21.2921 17.3733 15.7521C17.6633 15.5821 17.9534 15.4221 18.2534 15.2721L18.8733 14.9621C22.2633 13.3021 25.8934 12.452 29.7734 12.382C36.7134 12.242 44.4534 14.6422 52.9934 19.5622Z"
                    stroke="#E0E0E0"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M72.9932 9.56227L52.9932 19.5623C44.4532 14.6423 36.7132 12.2421 29.7732 12.3821C25.8932 12.4521 22.263 13.3022 18.873 14.9622L38.123 5.34205L38.1931 5.30226C47.7631 0.282258 59.3532 1.70227 72.9932 9.56227Z"
                    stroke="#E0E0E0"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium">No Ticket Selected</h3>
              <p className="text-sm mt-1">
                Click a support ticket to see messages sent
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
