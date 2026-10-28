import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTableState } from "@/contexts/TableStateContext";
import type {
  CollectionSearch,
  SearchCache,
  PageInfo,
  PageSize,
  PaginationOptions,
} from "@/lib/firestore-pagination";

export function useFirestorePagination(
  queryKey = "",
  search?: CollectionSearch,
) {
  const tableKey = JSON.stringify([queryKey, search?.fields ?? []]);
  const searchKey = JSON.stringify([
    search?.term.trim().toLowerCase(),
    search?.fields,
  ]);
  queryKey = `${queryKey}:${searchKey}`;
  const [saved, save] = useTableState(`firestore:${tableKey}`, {
    scope: queryKey,
    pageSize: 10 as PageSize,
    pageIndex: 0,
    total: 0,
    cursor: null as PaginationOptions["cursor"],
    cursors: [null] as Array<PaginationOptions["cursor"]>,
    lastDocument: null as PageInfo["lastDocument"],
  });
  const searchCache = useMemo<SearchCache>(() => ({}), [queryKey]);
  const [pageSize, setSize] = useState<PageSize>(saved.pageSize);
  const [pageIndex, setIndex] = useState(saved.pageIndex);
  const [total, setTotal] = useState(saved.total);
  const [cursor, setCursor] = useState<PaginationOptions["cursor"]>(
    saved.cursor,
  );
  const [pending, setPending] = useState(false);
  const [scope, setScope] = useState(saved.scope);
  const cursors = useRef<Array<PaginationOptions["cursor"]>>([
    ...saved.cursors,
  ]);
  const lastDocument = useRef<PageInfo["lastDocument"]>(saved.lastDocument);
  const latestRequest = useRef("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const confirmed = useRef({
    pageIndex: saved.pageIndex,
    cursor: saved.cursor,
  });
  const reset = useCallback(() => {
    cursors.current = [null];
    lastDocument.current = null;
    confirmed.current = { pageIndex: 0, cursor: null };
    setCursor(null);
    setIndex(0);
    setPending(false);
    save({
      scope: queryKey,
      pageSize,
      pageIndex: 0,
      total: 0,
      cursor: null,
      cursors: [null],
      lastDocument: null,
    });
  }, [queryKey, pageSize, save]);
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
      search,
      searchCache,
      isCurrent: () => mounted.current && requestKey === latestRequest.current,
      onPage: (info) => {
        if (!mounted.current || requestKey !== latestRequest.current) return;
        setTotal(info.total);
        lastDocument.current = info.lastDocument;
        confirmed.current = { pageIndex, cursor };
        save({
          scope: queryKey,
          pageSize,
          pageIndex,
          cursor,
          total: info.total,
          cursors: [...cursors.current],
          lastDocument: info.lastDocument,
        });
        setPending(false);
        // A deletion may empty the last page. Reload the preceding page.
        if (pageIndex > 0 && info.lastDocument === null) {
          setIndex(pageIndex - 1);
          setCursor(cursors.current[pageIndex - 1] ?? null);
        }
      },
      onError: () => {
        if (!mounted.current || requestKey !== latestRequest.current) return;
        setPending(false);
        setIndex(confirmed.current.pageIndex);
        setCursor(confirmed.current.cursor);
      },
    }),
    [pageSize, cursor, pageIndex, requestKey, searchCache, save],
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
    save({
      scope: queryKey,
      pageSize: size,
      pageIndex: 0,
      total: 0,
      cursor: null,
      cursors: [null],
      lastDocument: null,
    });
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
