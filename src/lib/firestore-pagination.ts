import {
  getDocs,
  getCountFromServer,
  onSnapshot,
  query,
  limit,
  startAfter,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";

export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export interface PageInfo {
  total: number;
  lastDocument: QueryDocumentSnapshot<DocumentData> | null;
}

export function subscribePaginatedDocs(
  baseQuery: Query<DocumentData>,
  options: PaginationOptions,
  callback: (snapshot: QuerySnapshot<DocumentData>) => void,
  onError: (error: Error) => void,
) {
  const pageSize = options.pageSize ?? 10;
  if (!PAGE_SIZES.includes(pageSize))
    throw new Error("Page size must be 10, 25, or 50.");
  const pageQuery = query(
    baseQuery,
    ...(options.cursor ? [startAfter(options.cursor)] : []),
    limit(pageSize),
  );
  let active = true;
  let revision = 0;
  const unsubscribe = onSnapshot(
    pageQuery,
    async (snapshot) => {
      const version = ++revision;
      try {
        const count = await getCountFromServer(baseQuery);
        if (!active || version !== revision) return;
        options.onPage?.({
          total: count.data().count,
          lastDocument: snapshot.docs.at(-1) ?? null,
        });
        callback(snapshot);
      } catch (error) {
        if (active && version === revision) {
          options.onError?.();
          onError(error as Error);
        }
      }
    },
    (error) => {
      if (active) {
        options.onError?.();
        onError(error);
      }
    },
  );
  return () => {
    active = false;
    unsubscribe();
  };
}
export interface PaginationOptions {
  pageSize?: PageSize;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  onPage?: (info: PageInfo) => void;
  onError?: () => void;
}

export async function getPaginatedDocs(
  baseQuery: Query<DocumentData>,
  options: PaginationOptions = {},
) {
  const pageSize = options.pageSize ?? 10;
  if (!PAGE_SIZES.includes(pageSize))
    throw new Error("Page size must be 10, 25, or 50.");
  const pageQuery = query(
    baseQuery,
    ...(options.cursor ? [startAfter(options.cursor)] : []),
    limit(pageSize),
  );
  const [snapshot, count] = await Promise.all([
    getDocs(pageQuery),
    getCountFromServer(baseQuery),
  ]).catch((error) => {
    options.onError?.();
    throw error;
  });
  options.onPage?.({
    total: count.data().count,
    lastDocument: snapshot.docs.at(-1) ?? null,
  });
  return snapshot;
}
