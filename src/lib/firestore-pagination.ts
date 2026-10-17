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

// Firestore has no case-insensitive substring operator. Search the complete
// authorized query in bounded batches, then paginate matches (never loaded rows).
export interface CollectionSearch {
  term: string;
  fields: readonly string[];
  matches?: (document: QueryDocumentSnapshot<DocumentData>) => Promise<boolean>;
}
export interface SearchCache {
  result?: Promise<QueryDocumentSnapshot<DocumentData>[]>;
}
export type DocumentPage = Pick<
  QuerySnapshot<DocumentData>,
  "docs" | "size" | "empty"
>;

export function matchesSearch(
  document: QueryDocumentSnapshot<DocumentData>,
  search: CollectionSearch,
) {
  const term = search.term.trim().toLowerCase();
  return search.fields.some((field) => {
    const value =
      field === "id"
        ? document.id
        : field
            .split(".")
            .reduce((value, key) => value?.[key], document.data());
    return (Array.isArray(value) ? value : [value]).some(
      (item) => item != null && String(item).toLowerCase().includes(term),
    );
  });
}

async function getSearchPage(
  baseQuery: Query<DocumentData>,
  options: PaginationOptions,
): Promise<DocumentPage> {
  const search = options.search!;
  const cache = options.searchCache ?? {};
  if (!cache.result) {
    cache.result = (async () => {
      const matches: QueryDocumentSnapshot<DocumentData>[] = [];
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
      while (true) {
        if (options.isCurrent && !options.isCurrent())
          throw new Error("Search superseded");
        const batch = await getDocs(
          query(baseQuery, ...(cursor ? [startAfter(cursor)] : []), limit(250)),
        );
        for (const document of batch.docs) {
          if (
            matchesSearch(document, search) ||
            (await search.matches?.(document))
          )
            matches.push(document);
        }
        if (batch.size < 250) break;
        cursor = batch.docs.at(-1);
      }
      return matches;
    })().catch((error) => {
      cache.result = undefined;
      throw error;
    });
  }
  const matches = await cache.result;
  if (options.isCurrent && !options.isCurrent())
    throw new Error("Search superseded");
  const start = options.cursor
    ? matches.findIndex((doc) => doc.id === options.cursor!.id) + 1
    : 0;
  const docs = matches.slice(start, start + (options.pageSize ?? 10));
  options.onPage?.({
    total: matches.length,
    lastDocument: docs.at(-1) ?? null,
  });
  return { docs, size: docs.length, empty: docs.length === 0 };
}

export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export interface PageInfo {
  total: number;
  lastDocument: QueryDocumentSnapshot<DocumentData> | null;
}

export function subscribePaginatedDocs(
  baseQuery: Query<DocumentData>,
  options: PaginationOptions,
  callback: (snapshot: DocumentPage) => void,
  onError: (error: Error) => void,
) {
  if (options.search?.term.trim()) {
    let active = true;
    void getPaginatedDocs(baseQuery, options)
      .then((page) => {
        if (active) callback(page);
      })
      .catch((error) => {
        if (active) onError(error);
      });
    return () => {
      active = false;
    };
  }
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
  search?: CollectionSearch;
  searchCache?: SearchCache;
  isCurrent?: () => boolean;
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
  if (options.search?.term.trim()) {
    try {
      return await getSearchPage(baseQuery, options);
    } catch (error) {
      options.onError?.();
      throw error;
    }
  }
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
