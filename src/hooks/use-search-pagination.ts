import { useEffect, useMemo, useRef, useState } from "react";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";

/** Debounce collection searches; a changed term always starts on page one. */
export function useSearchPagination(
  term: string,
  fields: readonly string[],
  scope = "",
) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const pagination = useFirestorePagination(scope, { term: debounced, fields });
  const options = useMemo(
    () => ({
      ...pagination.options,
      isCurrent: () => mounted.current && pagination.options.isCurrent!(),
    }),
    [pagination.options],
  );
  return { ...pagination, options };
}
