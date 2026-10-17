import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Archive,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Headset,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Search,
  Send,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SectionHelp } from "@/components/section-help";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/contexts/UserContext";
import { useTicketConversation } from "@/hooks/use-ticket-conversation";
import { useSearchPagination } from "@/hooks/use-search-pagination";
import { canViewTicket, filterTickets } from "@/lib/support-tickets";
import { cn } from "@/lib/utils";
import { supportService } from "@/services/support.service";
import { usersService } from "@/services/users.service";
import type { SupportTicket, User } from "@/types";

function dateLabel(value: SupportTicket["createdAt"]) {
  const date = value && ("toDate" in value ? value.toDate() : value);
  return date && !Number.isNaN(date.getTime())
    ? format(date, "dd MMM yyyy, h:mm a")
    : "Not recorded";
}

function StatusBadge({ status }: { status?: SupportTicket["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        status === "closed"
          ? "bg-muted text-muted-foreground"
          : status === "resolved"
            ? "bg-[var(--success-soft)] text-[var(--success)]"
            : status === "open"
              ? "bg-[var(--warning-soft)] text-[var(--warning)]"
              : "bg-secondary text-secondary-foreground",
      )}
    >
      {status === "in_progress"
        ? "In progress"
        : status
          ? status.charAt(0).toUpperCase() + status.slice(1)
          : "Unknown"}
    </span>
  );
}

function PlatformBadge({ platform }: { platform?: string }) {
  return platform ? (
    <span className="inline-flex whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      {platform}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Not tagged</span>
  );
}

export default function SupportTicketsPage() {
  const { user, adminType } = useCurrentUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [profiles, setProfiles] = useState<Record<string, User | null>>({});
  const profile = selectedTicket?.userId
    ? profiles[selectedTicket.userId]
    : null;
  const profileIds = JSON.stringify([
    ...new Set(
      tickets
        .filter((ticket) => !ticket.userType || ticket.userType === "user")
        .flatMap((ticket) => (ticket.userId ? [ticket.userId] : [])),
    ),
  ]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketError, setTicketError] = useState("");
  const [search, setSearch] = useState("");
  const ticketPagination = useSearchPagination(search, ["id", "userId", "userName", "userEmail", "userPhone", "issue", "lastMessage", "tags"]);
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [conversationOpen, setConversationOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const canRead = !!selectedTicket && canViewTicket(selectedTicket, adminType);
  const readOnly = selectedTicket?.status === "closed";

  const {
    messages,
    loading: loadingMessages,
    error: messageError,
    hasMore,
    viewport: messageViewport,
    sentinel: messageSentinel,
    retry,
  } = useTicketConversation(
    selectedTicket?.id ?? "",
    conversationOpen && canRead,
  );

  useEffect(() => {
    setLoadingTickets(true);
    setTicketError("");
    return supportService.getSupportTickets(
      (data) => {
        setTickets(data);
        setSelectedTicket((current) =>
          current
            ? (data.find((ticket) => ticket.id === current.id) ?? current)
            : null,
        );
        setLoadingTickets(false);
      },
      ticketPagination.options,
      (error) => {
        setLoadingTickets(false);
        setTicketError(error.message);
      },
    );
  }, [ticketPagination.options]);

  useEffect(() => {
    let active = true;
    const ids: string[] = JSON.parse(profileIds);
    Promise.all(
      ids.map(
        async (id) =>
          [id, await usersService.getUserById(id).catch(() => null)] as const,
      ),
    ).then((entries) => {
      if (active) setProfiles(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [profileIds]);

  const openTicket = (ticket: SupportTicket) => {
    if (!canViewTicket(ticket, adminType)) return;
    setSelectedTicket(ticket);
    setNewMessage("");
    setConversationOpen(false);
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !selectedTicket?.id ||
      !user?.id ||
      !newMessage.trim() ||
      readOnly ||
      !canRead ||
      sending ||
      closing
    )
      return;
    setSending(true);
    try {
      await supportService.sendSupportMessage(
        selectedTicket.id,
        user.id,
        newMessage.trim(),
      );
      setNewMessage("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (
      !selectedTicket?.id ||
      !user?.id ||
      readOnly ||
      !canRead ||
      closing ||
      sending
    )
      return;
    setClosing(true);
    const ticketId = selectedTicket.id;
    try {
      await supportService.closeTicket(
        ticketId,
        user.id,
        newMessage.trim() ||
          "This ticket is now closed, I hope all your issues have been resolved. If you have any other issues, please open a new ticket.",
      );
      setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, status: "closed" } : ticket));
      ticketPagination.options.searchCache!.result = undefined;
      setSelectedTicket((current) =>
        current?.id === ticketId ? { ...current, status: "closed" } : current,
      );
      setNewMessage("");
      toast.success("Ticket closed. Conversation retained.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to close ticket",
      );
    } finally {
      setClosing(false);
    }
  };

  const enrichedTickets = tickets.map((ticket) => {
    const account =
      (!ticket.userType || ticket.userType === "user") && ticket.userId
        ? profiles[ticket.userId]
        : null;
    return {
      ...ticket,
      userName: ticket.userName || account?.username,
      userEmail: ticket.userEmail || account?.email,
      userPhone: ticket.userPhone || account?.phonenumber,
    };
  });
  const visibleTickets = filterTickets(
    enrichedTickets,
    search,
    status,
    platform,
  );
  const platforms = [
    ...new Set(
      tickets.flatMap((ticket) => (ticket.platform ? [ticket.platform] : [])),
    ),
  ].sort();
  const profileBase =
    selectedTicket?.userType === "rider"
      ? "/riders"
      : selectedTicket?.userType === "vendor"
        ? "/vendors"
        : "/users";
  const name =
    selectedTicket?.userName ||
    profile?.username ||
    selectedTicket?.userId ||
    "Unknown account";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--success)]/30 bg-[var(--success-soft)] p-4 text-[var(--success)]">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" />
          <div>
            <h2 className="font-semibold">Keep the full support history</h2>
            <p className="mt-1 text-sm">
              Closing a ticket retains its conversation for review by super
              admins.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <Archive className="size-4" /> Closed conversations retained
        </div>
      </div>

      <div
        className={cn(
          "grid items-start gap-4 [--ticket-panel-height:clamp(36rem,calc(100dvh-14rem),64rem)]",
          selectedTicket && canRead && "xl:grid-cols-[minmax(0,1fr)_300px]",
        )}
      >
        <section
          className="flex h-[var(--ticket-panel-height)] min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
          aria-label="Support tickets"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b p-4">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              Support Tickets <SectionHelp title="Support Tickets" />
            </h1>
            <div className="flex w-full flex-wrap gap-2 lg:w-auto">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  aria-label="Search all tickets"
                  placeholder="Search ticket, account, or issue…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Filter by status" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ["all", "All statuses"],
                    ["open", "Open"],
                    ["pending", "Pending"],
                    ["in_progress", "In progress"],
                    ["resolved", "Resolved"],
                    ["closed", "Closed"],
                  ].map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger aria-label="Filter by platform" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {platforms.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">
            Search covers all tickets. Filters apply to the displayed results.{" "}
            {adminType !== "super" &&
              "Closed conversations are available to super admins."}
          </p>
          <div
            className="min-h-0 flex-1 overflow-auto overscroll-contain"
            tabIndex={0}
            role="region"
            aria-label="Scrollable support ticket table"
          >
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  {[
                    "Ticket ID",
                    "User / Rider / Vendor",
                    "Platform",
                    "Issue",
                    "Status",
                    "Created",
                    "Actions",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="sticky top-0 z-10 whitespace-nowrap border-b bg-card px-4 py-3 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTickets ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-12 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                      Loading tickets…
                    </td>
                  </tr>
                ) : ticketError ? (
                  <tr>
                    <td
                      colSpan={7}
                      role="alert"
                      className="p-8 text-center text-destructive"
                    >
                      Unable to load tickets: {ticketError}
                    </td>
                  </tr>
                ) : visibleTickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-12 text-center text-muted-foreground"
                    >
                      <Headset className="mx-auto mb-3 size-8" />
                      <p className="font-medium">No tickets found</p>
                      <p className="mt-1 text-xs">
                        {tickets.length
                          ? "Try another search or reset the filters."
                          : "Support requests will appear here."}
                      </p>
                      {tickets.length > 0 && (
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => {
                            setSearch("");
                            setStatus("all");
                            setPlatform("all");
                          }}
                        >
                          Reset filters
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  visibleTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className={cn(
                        "border-t hover:bg-muted/30",
                        selectedTicket?.id === ticket.id && "bg-accent/50",
                      )}
                    >
                      <td className="max-w-40 px-4 py-4">
                        <button
                          className="block w-full truncate text-left font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                          title={ticket.id}
                          disabled={!canViewTicket(ticket, adminType)}
                          onClick={() => openTicket(ticket)}
                        >
                          #{ticket.id}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <UserRound className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p
                              className="max-w-40 truncate font-medium"
                              title={ticket.userName || ticket.userId}
                            >
                              {ticket.userName ||
                                ticket.userId ||
                                "Unknown account"}
                            </p>
                            <p className="max-w-40 truncate text-xs capitalize text-muted-foreground">
                              {ticket.userType || "Account"}
                              {ticket.userPhone ? ` · ${ticket.userPhone}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <PlatformBadge platform={ticket.platform} />
                      </td>
                      <td className="max-w-48 px-4 py-4">
                        <p
                          className="truncate"
                          title={ticket.issue || ticket.lastMessage}
                        >
                          {ticket.issue || ticket.lastMessage || "No messages"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="min-w-36 px-4 py-4 text-xs tabular-nums text-muted-foreground">
                        {dateLabel(ticket.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View ticket ${ticket.id}`}
                          disabled={!canViewTicket(ticket, adminType)}
                          onClick={() => openTicket(ticket)}
                        >
                          {canViewTicket(ticket, adminType) ? (
                            "View"
                          ) : (
                            <>
                              <LockKeyhole className="size-3" /> Closed
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 border-t px-4 pb-4">
            <TablePagination
              pagination={ticketPagination}
              loading={loadingTickets}
            />
          </div>
        </section>

        {selectedTicket && canRead && (
          <aside
            className="flex h-[var(--ticket-panel-height)] min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
            aria-label="Ticket details"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b p-4">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold">
                  #{selectedTicket.id}
                </p>
                <div className="mt-2">
                  <StatusBadge status={selectedTicket.status} />
                </div>
                <h2 className="mt-3 break-words font-semibold">
                  {selectedTicket.issue || "Support request"}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close ticket details"
                onClick={() => setSelectedTicket(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 text-sm">
              <div className="rounded-md bg-muted/40 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <UserRound className="size-5 shrink-0 text-primary" />
                  <p className="break-all font-medium">{name}</p>
                </div>
                {(selectedTicket.userPhone || profile?.phonenumber) && (
                  <p className="break-all text-xs text-muted-foreground">
                    {selectedTicket.userPhone || profile?.phonenumber}
                  </p>
                )}
                {(selectedTicket.userEmail || profile?.email) && (
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {selectedTicket.userEmail || profile?.email}
                  </p>
                )}
                {selectedTicket.userId && (
                  <Link
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    to={`${profileBase}/${encodeURIComponent(selectedTicket.userId)}`}
                  >
                    View profile <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <Clock3 className="size-3" /> Created
                  </dt>
                  <dd className="text-right tabular-nums">
                    {dateLabel(selectedTicket.createdAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd className="text-right tabular-nums">
                    {dateLabel(selectedTicket.updatedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Assigned to</dt>
                  <dd className="break-all text-right">
                    {selectedTicket.assignedTo || "Unassigned"}
                  </dd>
                </div>
              </dl>
              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <span className="text-xs text-muted-foreground">Platform</span>
                <PlatformBadge platform={selectedTicket.platform} />
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold">
                  <Tag className="size-3" /> Tags
                </h3>
                <div className="flex flex-wrap gap-1">
                  {selectedTicket.tags?.length ? (
                    selectedTicket.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-1 text-xs"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No tags recorded
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold">Issue details</h3>
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                  {selectedTicket.issueDetails ||
                    selectedTicket.issue ||
                    selectedTicket.lastMessage ||
                    "No details recorded"}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold">Notes</h3>
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                  {selectedTicket.notes || "No notes recorded"}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setConversationOpen(true)}
              >
                <MessageSquare className="size-4" />
                View full conversation
              </Button>
              {readOnly && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <LockKeyhole className="size-4 shrink-0" />
                  This ticket is closed. Super admins can review its
                  conversation.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      <Sheet
        open={conversationOpen && canRead}
        onOpenChange={setConversationOpen}
      >
        <SheetContent
          overlayClassName="backdrop-blur-sm"
          className="h-dvh w-full gap-0 bg-card sm:max-w-xl"
        >
          <SheetHeader className="shrink-0 border-b p-5 pr-12 text-left">
            <SheetTitle className="break-all">
              Ticket #{selectedTicket?.id}
            </SheetTitle>
            <SheetDescription>
              {readOnly
                ? "Closed conversation · read-only"
                : "Review the conversation and reply to this request."}
            </SheetDescription>
          </SheetHeader>
          <div
            ref={messageViewport}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [overflow-anchor:none]"
            role="region"
            tabIndex={0}
            aria-label="Ticket messages"
            aria-busy={loadingMessages}
          >
            <div
              ref={messageSentinel}
              className="flex min-h-10 items-center justify-center text-xs text-muted-foreground"
              role="status"
            >
              {loadingMessages ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading messages…
                </span>
              ) : messageError ? (
                <span role="alert">
                  Unable to load conversation: {messageError}{" "}
                  <Button variant="link" size="sm" onClick={retry}>
                    Try again
                  </Button>
                </span>
              ) : messages.length > 0 ? (
                hasMore ? (
                  "Scroll up for older messages"
                ) : (
                  "Beginning of conversation"
                )
              ) : null}
            </div>
            {!loadingMessages && !messageError && messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No messages yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={cn(
                      "w-fit max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      message.senderId === selectedTicket?.userId
                        ? "bg-muted"
                        : "ml-auto bg-primary text-primary-foreground",
                    )}
                  >
                    <p className="mb-1 text-xs font-medium">
                      {message.senderId === selectedTicket?.userId
                        ? "Requester"
                        : "Support"}
                    </p>
                    {message.imageurl && (
                      <a
                        href={message.imageurl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={message.imageurl}
                          alt="Ticket attachment; open full image"
                          className="max-h-64 rounded object-contain"
                        />
                      </a>
                    )}
                    {message.message && (
                      <p className="whitespace-pre-wrap break-words">
                        {message.message}
                      </p>
                    )}
                    <p className="mt-1 text-xs opacity-80">
                      {dateLabel(message.timestamp || message.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {readOnly ? (
            <p className="flex shrink-0 items-start gap-2 border-t p-5 text-sm text-muted-foreground">
              <LockKeyhole className="size-4" />
              Closed tickets are read-only and cannot be reopened.
            </p>
          ) : (
            <div className="shrink-0 space-y-3 border-t p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  aria-label="Reply to ticket"
                  placeholder="Type a message…"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  disabled={sending || closing}
                />
                <Button
                  type="submit"
                  aria-label="Send reply"
                  disabled={!newMessage.trim() || sending || closing}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </form>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="max-w-sm text-xs text-muted-foreground">
                  Closing is permanent. Your draft will be sent as the closing
                  message, or a default message if empty.
                </p>
                <Button
                  variant="outline"
                  onClick={closeTicket}
                  disabled={closing || sending}
                >
                  {closing && <Loader2 className="size-4 animate-spin" />}Close
                  ticket
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
