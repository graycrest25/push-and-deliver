import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useLocation } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";

const TableStateContext = createContext<{
  pathname: string;
  values: Map<string, unknown>;
} | null>(null);

function SectionTableState({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const [values] = useState(() => new Map<string, unknown>());
  const context = useMemo(() => ({ pathname, values }), [pathname, values]);
  return (
    <TableStateContext.Provider value={context}>
      {children}
    </TableStateContext.Provider>
  );
}

/** Detail routes share their section's memory. Leaving a section discards it. */
export function TableStateProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useCurrentUser();
  const section = pathname.split("/").filter(Boolean)[0] ?? "";
  return (
    <SectionTableState
      key={`${user?.id}:${user?.adminType}:${section}`}
      pathname={pathname}
    >
      {children}
    </SectionTableState>
  );
}

/** Retain table navigation and filters, never requests or loading flags. */
export function useTableState<T>(
  name: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(TableStateContext);
  const key = JSON.stringify([context?.pathname, name]);
  const values = context?.values;
  const [state, setState] = useState(() => ({
    key,
    value: values?.has(key)
      ? (values.get(key) as T)
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial,
  }));
  let value = state.value;
  if (state.key !== key) {
    value = values?.has(key)
      ? (values.get(key) as T)
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial;
    setState({ key, value });
  }
  const latest = useRef(value);
  latest.current = value;
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      const next =
        typeof update === "function"
          ? (update as (previous: T) => T)(latest.current)
          : update;
      latest.current = next;
      values?.set(key, next);
      setState({ key, value: next });
    },
    [key, values],
  );
  return [value, setValue];
}
