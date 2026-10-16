import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supportService } from "@/services/support.service";
import type { TicketMessage } from "@/types";

const BATCH_SIZE = 25;

export function useTicketConversation(ticketId: string, open: boolean) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messageLimit, setMessageLimit] = useState(BATCH_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const position = useRef<{
    height: number;
    top: number;
    bottom: boolean;
  } | null>(null);

  useEffect(() => {
    setMessages([]);
    setMessageLimit(BATCH_SIZE);
    setHasMore(false);
    initialized.current = false;
    position.current = null;
  }, [ticketId, open]);

  useEffect(() => {
    if (!ticketId || !open) return;
    let active = true;
    setLoading(true);
    setError("");
    const unsubscribe = supportService.subscribeConversation(
      ticketId,
      messageLimit,
      (data, more) => {
        if (!active) return;
        const element = viewport.current;
        if (element)
          position.current = {
            height: element.scrollHeight,
            top: element.scrollTop,
            bottom:
              !initialized.current ||
              element.scrollHeight - element.clientHeight - element.scrollTop <
                48,
          };
        setMessages(data);
        setHasMore(more);
        setLoading(false);
      },
      (failure) => {
        if (!active) return;
        setError(failure.message);
        setLoading(false);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [ticketId, open, messageLimit, attempt]);

  useLayoutEffect(() => {
    const element = viewport.current;
    const previous = position.current;
    if (!element || !previous) return;
    element.scrollTop = previous.bottom
      ? element.scrollHeight
      : previous.top + element.scrollHeight - previous.height;
    initialized.current = true;
    position.current = null;
  }, [messages]);

  useEffect(() => {
    if (
      !open ||
      loading ||
      error ||
      !hasMore ||
      !sentinel.current ||
      !viewport.current
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setMessageLimit((current) => current + BATCH_SIZE);
        }
      },
      { root: viewport.current, rootMargin: "80px 0px 0px 0px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [open, loading, error, hasMore, messages]);

  return {
    messages,
    loading,
    error,
    hasMore,
    viewport,
    sentinel,
    retry: () => setAttempt((current) => current + 1),
  };
}
