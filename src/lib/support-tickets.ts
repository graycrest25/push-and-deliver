import type { SupportTicket } from "@/types";

export function canViewTicket(ticket: SupportTicket, adminType?: string) {
  return ticket.status !== "closed" || adminType === "super";
}

export function filterTickets(
  tickets: SupportTicket[],
  search: string,
  status: string,
  platform: string,
) {
  const term = search.trim().toLowerCase();
  return tickets.filter(
    (ticket) =>
      (status === "all" || ticket.status === status) &&
      (platform === "all" || ticket.platform === platform) &&
      [
        ticket.id,
        ticket.userId,
        ticket.userName,
        ticket.userEmail,
        ticket.userPhone,
        ticket.issue,
        ticket.lastMessage,
        ...(ticket.tags ?? []),
      ].some((value) => value?.toLowerCase().includes(term)),
  );
}
