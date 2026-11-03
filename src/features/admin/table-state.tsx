import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import type { RecordData } from "@/lib/api";
export type SavedTable = {
  filters: RecordData;
  draft: RecordData;
  size: number;
  cursors: string[];
  page: number;
  scrollTop: number;
  scrollLeft: number;
};
const Context = createContext<Map<string, SavedTable> | null>(null);
// Keep navigation state only, never account records. Leaving a section or changing
// identity discards it. Detail routes and their Back links share the same store.
export function TableStateProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useCurrentUser();
  const section = pathname.startsWith("/admin/")
    ? "/admin"
    : ["users", "user-activation", "weekly-concentration"].includes(
          pathname.split("/")[1],
        )
      ? "users"
      : ["riders", "rider-weekly-deliveries"].includes(pathname.split("/")[1])
        ? "riders"
        : pathname.split("/")[1];
  const store = useMemo(
    () => new Map<string, SavedTable>(),
    [section, user?.id, user?.adminType],
  );
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export const useTableStateStore = () => useContext(Context);
