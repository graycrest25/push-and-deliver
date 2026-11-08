import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IconArrowLeft, IconPaperclip, IconSend } from "@tabler/icons-react";
import {
  api,
  apiURL,
  ApiError,
  queryPath,
  segment,
  type RecordData,
} from "@/lib/api";
import { useCurrentUser } from "@/contexts/UserContext";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { ErrorNotice, Notice, RecordView, display } from "./shared";

const tickets = "/v1/admin/support/tickets";
const closingMessage =
  "This ticket is now closed, I hope all your issues have been resolved. If you have any other issues, please open a new ticket.";
const ticketPath = (id: string) => `${tickets}/${segment(id)}`;
type Command = "claim" | "status" | "messages";
type Pending = { command: Command; body: string; key: string };

// An uncertain response must retry the identical request, including its key.
function useTicketCommand(id: string, reload: () => void) {
  const pending = useRef<Pending>();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<Command>();
  const [error, setError] = useState<unknown>(null);
  const [conflict, setConflict] = useState(false);
  async function run(
    command: Command,
    body: () => Promise<RecordData>,
    success: (result: RecordData) => void,
  ) {
    if (
      lock.current ||
      conflict ||
      (pending.current && pending.current.command !== command)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!pending.current) {
        pending.current = {
          command,
          body: JSON.stringify(await body()),
          key: crypto.randomUUID(),
        };
        setPendingCommand(command);
      }
      const result = await api(`${ticketPath(id)}/${command}`, {
        method: command === "status" ? "PUT" : "POST",
        body: pending.current.body,
        headers: { "Idempotency-Key": pending.current.key },
      });
      pending.current = undefined;
      setPendingCommand(undefined);
      success(result);
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        failure.status >= 400 &&
        failure.status < 500 &&
        ![408, 429].includes(failure.status)
      ) {
        pending.current = undefined;
        setPendingCommand(undefined);
        if (failure.status === 409) {
          if (command === "status") setConflict(true);
          reload();
        }
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    error,
    pendingCommand,
    conflict,
    reviewConflict: () => {
      setConflict(false);
      setError(null);
    },
  };
}
async function versioned(id: string, changes: RecordData = {}) {
  const current = await api(ticketPath(id));
  if (!Number.isSafeInteger(current.version) || current.version < 0)
    throw new Error("Refresh the ticket to load its current version.");
  return { ...changes, expectedVersion: current.version };
}

export function ClaimTicketButton({
  id,
  reload,
}: {
  id: string;
  reload: () => void;
}) {
  const navigate = useNavigate();
  const command = useTicketCommand(id, reload);
  return (
    <div className="space-y-3">
      <Button
        disabled={command.busy}
        onClick={() =>
          void command.run(
            "claim",
            () => versioned(id),
            () => navigate(`/support-tickets/${segment(id)}`),
          )
        }
      >
        {command.busy
          ? "Claiming…"
          : command.pendingCommand
            ? "Retry claim"
            : "Claim ticket"}
      </Button>
      {command.error != null && <ErrorNotice error={command.error} />}
    </div>
  );
}

const dayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Lagos" });
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Africa/Lagos",
});
function messageDay(value: string | undefined) {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime())
    ? { key: dayKey.format(date), label: dayLabel.format(date) }
    : { key: "unavailable", label: "Date unavailable" };
}
function mergeMessages(previous: RecordData[], incoming: RecordData[]) {
  const records = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) records.set(message.id, message);
  return [...records.values()].sort(
    (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
  );
}
function useMessages(id: string, enabled: boolean) {
  const [items, setItems] = useState<RecordData[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const initialized = useRef(false);
  const olderLock = useRef(false);
  const olderController = useRef<AbortController>();
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let latestRequest = 0;
    const load = async () => {
      const request = ++latestRequest;
      try {
        const data = await api(
          queryPath(`${ticketPath(id)}/messages`, { limit: DEFAULT_PAGE_SIZE }),
          { signal: controller.signal },
        );
        if (controller.signal.aborted || request !== latestRequest) return;
        setItems((previous) => mergeMessages(previous, data.items || []));
        if (!initialized.current) {
          setCursor(data.hasMore ? data.nextCursor : null);
          initialized.current = true;
        }
        setError(null);
      } catch (failure) {
        if (!controller.signal.aborted && request === latestRequest)
          setError(failure);
      } finally {
        if (!controller.signal.aborted && request === latestRequest)
          setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [id, enabled, revision]);
  useEffect(() => () => olderController.current?.abort(), []);
  async function older() {
    if (!cursor || olderLock.current) return;
    olderLock.current = true;
    setOlderLoading(true);
    const controller = new AbortController();
    olderController.current = controller;
    try {
      const data = await api(
        queryPath(`${ticketPath(id)}/messages`, {
          limit: DEFAULT_PAGE_SIZE,
          cursor,
        }),
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setItems((previous) => mergeMessages(previous, data.items || []));
      setCursor(data.hasMore ? data.nextCursor : null);
      setError(null);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure);
    } finally {
      olderLock.current = false;
      if (!controller.signal.aborted) setOlderLoading(false);
    }
  }
  return { items, cursor, loading, olderLoading, error, older, refresh };
}

export function SupportConversation() {
  const { id = "" } = useParams();
  return <Conversation key={id} id={id} />;
}
function Conversation({ id }: { id: string }) {
  const { user, adminType } = useCurrentUser();
  const navigate = useNavigate();
  const [closeOpen, setCloseOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [closure, setClosure] = useState<RecordData | null>(null);
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousHeight = useRef<number>();
  const closingNotice = useRef<{ body: string; key: string; sent: boolean }>();
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void api(ticketPath(id), { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure);
          if (failure instanceof ApiError && failure.status === 403)
            setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision]);
  const allowed = !!data && (data.status !== "closed" || adminType === "super");
  const claimed = !!data && !!user?.id && data.assignedSupportUid === user.id;
  const messages = useMessages(id, allowed);
  const command = useTicketCommand(id, reload);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (previousHeight.current !== undefined) {
      element.scrollTop += element.scrollHeight - previousHeight.current;
      previousHeight.current = undefined;
    } else if (nearBottom.current)
      bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.items]);
  const refresh = () => {
    reload();
    messages.refresh();
  };
  async function statusBody() {
    const status = data?.status === "open" ? "closed" : "open";
    const trimmed = summary.trim();
    if (status === "closed" && (!trimmed || [...trimmed].length > 1000))
      throw new Error(
        "Enter a closure summary of 1–1,000 characters after trimming.",
      );
    if (status === "open" && adminType !== "super")
      throw new Error("Only a super administrator can reopen tickets.");
    if (status === "closed") {
      const notice = (closingNotice.current ??= {
        body: JSON.stringify({
          message: closingMessage,
          clientMessageId: crypto.randomUUID(),
        }),
        key: crypto.randomUUID(),
        sent: false,
      });
      if (!notice.sent) {
        try {
          await api(`${ticketPath(id)}/messages`, {
            method: "POST",
            body: notice.body,
            headers: { "Idempotency-Key": notice.key },
          });
          notice.sent = true;
          messages.refresh();
        } catch (failure) {
          if (
            failure instanceof ApiError &&
            failure.status >= 400 &&
            failure.status < 500 &&
            ![408, 429].includes(failure.status)
          )
            closingNotice.current = undefined;
          throw failure;
        }
      }
    }
    // Posting the notice changes the ticket version. Read it only afterwards.
    return versioned(id, {
      status,
      ...(status === "closed" ? { summary: trimmed } : {}),
    });
  }
  function statusSaved(result: RecordData) {
    closingNotice.current = undefined;
    setCloseOpen(false);
    setSummary("");
    if (data?.status === "open") {
      toast.success("Ticket closed. Closure summary saved.");
      if (adminType !== "super") {
        navigate("/support-tickets", { replace: true });
        return;
      }
      setClosure(result.closure || null);
    } else
      toast.success("Ticket reopened. Previous closure history is retained.");
    refresh();
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!claimed || data?.status !== "open") return;
    await command.run(
      "messages",
      async () => {
        const text = message.trim();
        if (!text || text.includes("\0") || [...text].length > 4000)
          throw new Error(
            "Enter a message of 1–4,000 characters without null characters.",
          );
        return { message: text, clientMessageId: crypto.randomUUID() };
      },
      () => {
        setMessage("");
        nearBottom.current = true;
        refresh();
        requestAnimationFrame(() =>
          document.getElementById("support-reply")?.focus(),
        );
      },
    );
  }
  return (
    <div className="space-y-4">
      <Link
        to="/support-tickets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <IconArrowLeft size={16} aria-hidden="true" />
        Back to support tickets
      </Link>
      {error != null && <ErrorNotice error={error} retry={reload} />}
      {!data && loading && (
        <RecordSkeleton label="Loading conversation…" fields={6} />
      )}
      {data && !allowed && (
        <Notice>
          This ticket is closed. Only a super administrator can view or reopen
          it.
        </Notice>
      )}
      {data && allowed && (
        <>
          <section
            aria-label="Support conversation"
            className="flex h-[calc(100dvh-15rem)] min-h-[480px] max-h-[960px] flex-col overflow-hidden rounded-xl border bg-card"
          >
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold">
                    Support conversation
                  </h1>
                  <Badge variant="secondary">
                    {data.status === "open" ? "Open" : "Closed"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {data.customer?.name ||
                    data.customerName ||
                    "Customer details unavailable"}{" "}
                  ·{" "}
                  {claimed
                    ? "Assigned to you"
                    : data.assignedSupportUid
                      ? "Assigned to another agent"
                      : "Unassigned"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {data.status === "closed" && !claimed && (
                  <Button
                    size="sm"
                    disabled={
                      command.busy ||
                      (!!command.pendingCommand &&
                        command.pendingCommand !== "claim")
                    }
                    onClick={() =>
                      void command.run("claim", () => versioned(id), refresh)
                    }
                  >
                    Claim ticket
                  </Button>
                )}
                <RefreshButton loading={loading} onClick={refresh}>
                  Refresh conversation
                </RefreshButton>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    command.busy ||
                    (!!command.pendingCommand &&
                      command.pendingCommand !== "status")
                  }
                  onClick={() =>
                    data.status === "open"
                      ? setCloseOpen(true)
                      : void command.run("status", statusBody, statusSaved)
                  }
                >
                  {command.busy && command.pendingCommand === "status"
                    ? "Saving…"
                    : data.status === "open"
                      ? "Close ticket"
                      : "Reopen ticket"}
                </Button>
              </div>
            </header>
            <div
              ref={viewport}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30 px-4 py-5 sm:px-6"
              onScroll={(event) => {
                const element = event.currentTarget;
                nearBottom.current =
                  element.scrollHeight -
                    element.scrollTop -
                    element.clientHeight <
                  100;
              }}
            >
              {messages.cursor && (
                <div className="mb-5 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={messages.olderLoading}
                    onClick={() => {
                      previousHeight.current = viewport.current?.scrollHeight;
                      void messages.older();
                    }}
                  >
                    {messages.olderLoading ? "Loading…" : "Load older messages"}
                  </Button>
                </div>
              )}
              {messages.error != null && (
                <ErrorNotice error={messages.error} retry={messages.refresh} />
              )}
              {messages.loading && (
                <RecordSkeleton
                  label="Loading messages…"
                  fields={3}
                  singleColumn
                />
              )}
              {!messages.loading &&
                !messages.error &&
                !messages.items.length && (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    No messages yet. The conversation will appear here.
                  </p>
                )}
              <div
                role="log"
                aria-label="Conversation messages"
                aria-relevant="additions text"
                className="space-y-5"
              >
                {messages.items.map((item, index) => {
                  const support = item.senderRole === "support";
                  const day = messageDay(item.createdAt);
                  const previousDay = index
                    ? messageDay(messages.items[index - 1].createdAt).key
                    : null;
                  return (
                    <div key={item.id}>
                      {day.key !== previousDay && (
                        <p className="mb-5 text-center text-xs text-muted-foreground">
                          {day.label}
                        </p>
                      )}
                      <article
                        aria-label={`${support ? "Support" : "Customer"} message`}
                        className={`flex flex-col ${support ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[90%] space-y-2 rounded-2xl px-4 py-3 sm:max-w-[75%] lg:max-w-[65%] ${support ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card text-card-foreground"}`}
                        >
                          <p className="text-xs font-semibold">
                            {support
                              ? item.senderId === user?.id
                                ? "You"
                                : "Support"
                              : data.customer?.name ||
                                data.customerName ||
                                "Customer"}
                          </p>
                          {item.message && (
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                              {item.message}
                            </p>
                          )}
                          {item.attachment?.assetId &&
                            (claimed ? (
                              <a
                                className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
                                href={apiURL(
                                  `/v1/media/${segment(item.attachment.assetId)}/content`,
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <IconPaperclip size={15} aria-hidden="true" />
                                Download attachment
                              </a>
                            ) : (
                              <p className="text-xs">
                                Claim ticket to download
                              </p>
                            ))}
                          {item.attachmentUnavailable && (
                            <p className="text-xs">Attachment unavailable</p>
                          )}
                        </div>
                        <time
                          dateTime={item.createdAt}
                          className="mt-1.5 px-1 text-xs text-muted-foreground"
                        >
                          {display(item.createdAt, "createdAt")}
                        </time>
                      </article>
                    </div>
                  );
                })}
              </div>
              <div ref={bottom} />
            </div>
            <div className="shrink-0 border-t bg-card p-4 sm:px-6">
              {command.error != null && (
                <div className="mb-3">
                  <ErrorNotice error={command.error} />
                </div>
              )}
              {data.status === "closed" ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  This ticket is closed. Reopen it before replying.
                </p>
              ) : !claimed ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Claim this ticket to reply and access customer attachments.
                  </p>
                  <Button
                    disabled={
                      command.busy ||
                      (!!command.pendingCommand &&
                        command.pendingCommand !== "claim")
                    }
                    onClick={() =>
                      void command.run("claim", () => versioned(id), refresh)
                    }
                  >
                    {command.busy ? "Claiming…" : "Claim ticket"}
                  </Button>
                </div>
              ) : (
                <form onSubmit={send} className="space-y-2">
                  <Label htmlFor="support-reply">Message to customer</Label>
                  <div className="flex items-end gap-3">
                    <Textarea
                      id="support-reply"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Write a reply…"
                      maxLength={4000}
                      disabled={command.busy || !!command.pendingCommand}
                      className="max-h-40 min-h-20 resize-none"
                    />
                    <Button
                      type="submit"
                      className="shrink-0"
                      disabled={
                        command.busy ||
                        (command.pendingCommand !== "messages" &&
                          (!message.trim() || !!command.pendingCommand))
                      }
                    >
                      <IconSend size={17} aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {command.busy
                          ? "Sending…"
                          : command.pendingCommand === "messages"
                            ? "Retry reply"
                            : "Send reply"}
                      </span>
                      <span className="sr-only sm:hidden">
                        {command.pendingCommand === "messages"
                          ? "Retry reply"
                          : "Send reply"}
                      </span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {command.pendingCommand === "messages"
                      ? "Retry sends the same message safely."
                      : "Replies are sent to the customer. Messages refresh every 15 seconds."}
                  </p>
                </form>
              )}
            </div>
          </section>
          <Dialog
            open={closeOpen}
            onOpenChange={(open) => {
              if (!command.busy && command.pendingCommand !== "status")
                setCloseOpen(open);
            }}
          >
            <DialogContent
              showCloseButton={
                !command.busy && command.pendingCommand !== "status"
              }
            >
              <DialogHeader>
                <DialogTitle>Close support ticket</DialogTitle>
                <DialogDescription>
                  Record the issue and resolution before closing this ticket.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void command.run("status", statusBody, statusSaved);
                }}
              >
                <Label htmlFor="closure-summary">
                  Briefly describe the issue and how you handled it.
                </Label>
                <Textarea
                  id="closure-summary"
                  required
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  disabled={command.busy || command.pendingCommand === "status"}
                  aria-describedby="closure-summary-help"
                />
                <p
                  id="closure-summary-help"
                  className="text-xs text-muted-foreground"
                >
                  {[...summary.trim()].length}/1,000 characters after trimming.
                  Your summary is kept if saving fails.
                </p>
                {command.error != null && <ErrorNotice error={command.error} />}
                {command.conflict && (
                  <div className="space-y-3">
                    <p className="text-sm">
                      The ticket changed. Review the refreshed ticket before
                      starting a new close operation.
                    </p>
                    <RecordView
                      data={{
                        status: data.status,
                        version: data.version,
                        assignedSupportUid: data.assignedSupportUid,
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading || !!error}
                      onClick={command.reviewConflict}
                    >
                      I reviewed the refreshed ticket
                    </Button>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={
                    command.busy ||
                    command.conflict ||
                    !summary.trim() ||
                    [...summary.trim()].length > 1000 ||
                    data.status !== "open"
                  }
                >
                  {command.busy
                    ? "Closing…"
                    : command.pendingCommand === "status"
                      ? "Retry closing ticket"
                      : "Confirm closure"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          {command.conflict && !closeOpen && (
            <Notice>
              <p>Review the refreshed ticket before retrying.</p>
              <Button
                disabled={loading || !!error}
                onClick={command.reviewConflict}
              >
                I reviewed the refreshed ticket
              </Button>
            </Notice>
          )}
          {closure && adminType === "super" && (
            <section
              aria-label="Saved closure"
              className="rounded-lg border p-4 space-y-3"
            >
              <h2 className="font-semibold">Saved closure</h2>
              <RecordView data={closure} />
            </section>
          )}
          {adminType === "super" && (
            <Link
              className="text-sm text-primary underline"
              to={`/support-closures?ticketId=${segment(id)}`}
            >
              View closure history
            </Link>
          )}
          <details className="rounded-lg border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">
              Ticket details
            </summary>
            <div className="pt-4">
              <RecordView
                data={{
                  ticket: data.id,
                  customer: data.customerUid,
                  customerName:
                    data.customer?.name || "Customer details unavailable",
                  customerEmail:
                    data.customer?.email || "Customer details unavailable",
                  customerPhone:
                    data.customer?.phoneNumber ||
                    "Customer details unavailable",
                  assignedTo: data.assignedSupportUid || "Unassigned",
                  createdAt: data.createdAt,
                  updatedAt: data.updatedAt,
                }}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
