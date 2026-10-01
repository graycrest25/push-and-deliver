import { useCallback, useMemo, useRef, useState } from "react";
import type {
  PageInfo,
  PageSize,
  PaginationOptions,
} from "@/lib/firestore-pagination";

export function useFirestorePagination(queryKey = "") {
  const [pageSize, setSize] = useState<PageSize>(10);
  const [pageIndex, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<PaginationOptions["cursor"]>(null);
  const [pending, setPending] = useState(false);
  const [scope, setScope] = useState(queryKey);
  const cursors = useRef<Array<PaginationOptions["cursor"]>>([null]);
  const lastDocument = useRef<PageInfo["lastDocument"]>(null);
  const latestRequest = useRef("");
  const confirmed = useRef({
    pageIndex: 0,
    cursor: null as PaginationOptions["cursor"],
  });
  const reset = useCallback(() => {
    cursors.current = [null];
    lastDocument.current = null;
    confirmed.current = { pageIndex: 0, cursor: null };
    setCursor(null);
    setIndex(0);
    setPending(false);
  }, []);
  // Reset this component's pagination before rendering a different document/query.
  if (scope !== queryKey) {
    setScope(queryKey);
    setTotal(0);
    reset();
  }
  const requestKey = `${queryKey}:${pageSize}:${pageIndex}`;
  latestRequest.current = requestKey;
  const options = useMemo<PaginationOptions>(
    () => ({
      pageSize,
      cursor,
      onPage: (info) => {
        if (requestKey !== latestRequest.current) return;
        setTotal(info.total);
        lastDocument.current = info.lastDocument;
        confirmed.current = { pageIndex, cursor };
        setPending(false);
        // A deletion may empty the last page. Reload the preceding page.
        if (pageIndex > 0 && info.lastDocument === null) {
          setIndex(pageIndex - 1);
          setCursor(cursors.current[pageIndex - 1] ?? null);
        }
      },
      onError: () => {
        if (requestKey !== latestRequest.current) return;
        setPending(false);
        setIndex(confirmed.current.pageIndex);
        setCursor(confirmed.current.cursor);
      },
    }),
    [pageSize, cursor, pageIndex, requestKey],
  );
  const totalPages = Math.ceil(total / pageSize);
  const next = () => {
    if (pending || pageIndex + 1 >= totalPages || !lastDocument.current) return;
    cursors.current[pageIndex + 1] = lastDocument.current;
    setPending(true);
    setCursor(lastDocument.current);
    setIndex(pageIndex + 1);
  };
  const previous = () => {
    if (pending || pageIndex === 0) return;
    setPending(true);
    setCursor(cursors.current[pageIndex - 1] ?? null);
    setIndex(pageIndex - 1);
  };
  const setPageSize = (size: PageSize) => {
    reset();
    setSize(size);
  };
  return {
    options,
    pending,
    pageSize,
    pageIndex,
    total,
    totalPages,
    next,
    previous,
    reset,
    setPageSize,
  };
}
