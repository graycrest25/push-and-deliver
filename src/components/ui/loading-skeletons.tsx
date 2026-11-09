import { tableColumnClass } from "@/lib/table-layout";
import { useEffect, useState, type ReactNode } from "react";
import { TabSectionSkeleton, tabPageLayout } from "./tab-section-skeleton";
import { Skeleton } from "./skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
function RecordFields({
  fields = 9,
  singleColumn = false,
}: {
  fields?: number;
  singleColumn?: boolean;
}) {
  return (
    <div
      className={`grid gap-x-6 gap-y-4 ${singleColumn ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-3"}`}
    >
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-24 max-w-full" />
          <Skeleton
            className={`h-5 max-w-full ${i % 3 === 0 ? "w-40" : i % 3 === 1 ? "w-28" : "w-20"}`}
          />
        </div>
      ))}
    </div>
  );
}
export function RecordSkeleton({
  label = "Loading details…",
  fields = 9,
  singleColumn = false,
}: {
  label?: string;
  fields?: number;
  singleColumn?: boolean;
}) {
  return (
    <LoadingRegion label={label}>
      <RecordFields fields={fields} singleColumn={singleColumn} />
    </LoadingRegion>
  );
}
export function FormSkeleton({
  label = "Loading settings…",
  fields = 4,
}: {
  label?: string;
  fields?: number;
}) {
  return (
    <LoadingRegion label={label}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
    </LoadingRegion>
  );
}
export function TableSkeleton({
  columns,
  columnKeys,
  rows = 6,
  hasAction = false,
  label = "Loading records…",
}: {
  columns: string[];
  columnKeys?: string[];
  rows?: number;
  hasAction?: boolean;
  label?: string;
}) {
  return (
    <LoadingRegion label={label}>
      <div className="max-h-[65vh] overflow-hidden rounded-lg border">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              {columns.map((title, i) => (
                <TableHead
                  key={i}
                  className={tableColumnClass(columnKeys?.[i] || title)}
                >
                  {title}
                </TableHead>
              ))}
              {hasAction && (
                <TableHead>
                  <span className="sr-only">Open record</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: Math.min(rows, 8) }, (_, row) => (
              <TableRow key={row}>
                {columns.map((_, column) => (
                  <TableCell
                    key={column}
                    className={tableColumnClass(
                      columnKeys?.[column] || columns[column],
                    )}
                  >
                    <Skeleton
                      className={`h-4 max-w-full ${column % 3 === 0 ? "w-32" : "w-20"}`}
                    />
                  </TableCell>
                ))}
                {hasAction && (
                  <TableCell>
                    <Skeleton className="h-8 w-16" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </LoadingRegion>
  );
}
function SectionPlaceholder({ fields }: { fields: number }) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
      <Skeleton className="h-5 w-40" />
      <RecordFields fields={fields} />
    </div>
  );
}
export function ProfileSkeleton({ riders = false }: { riders?: boolean }) {
  return (
    <LoadingRegion label="Loading profile…">
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between gap-4 border-b pb-5">
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="flex flex-wrap gap-5">
          {Array.from({ length: riders ? 5 : 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
        <SectionPlaceholder fields={6} />
        <SectionPlaceholder fields={3} />
        {riders && <SectionPlaceholder fields={4} />}
        <SectionPlaceholder fields={2} />
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}
export function OverviewSkeleton() {
  return (
    <LoadingRegion label="Loading overview…">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="rounded-xl border bg-card p-5 space-y-4" key={i}>
              <Skeleton className="h-4 w-24 max-w-full" />
              <Skeleton className="h-8 w-20 max-w-full" />
            </div>
          ))}
        </div>
        <SectionPlaceholder fields={6} />
      </div>
    </LoadingRegion>
  );
}
export function WorkspaceSkeleton() {
  const [location, setLocation] = useState({ pathname: "", search: "" });
  useEffect(() => {
    setLocation({
      pathname: window.location.pathname,
      search: window.location.search,
    });
  }, []);
  const layout = tabPageLayout(location.pathname);
  const requested = new URLSearchParams(location.search).get("tab");
  const active =
    layout?.tabs.find(([id]) => id === requested)?.[0] || layout?.tabs[0][0];
  return (
    <LoadingRegion label="Loading workspace…">
      <div className="min-h-screen bg-background flex">
        <div className="hidden md:block w-[264px] shrink-0 border-r bg-card p-6 space-y-8">
          <Skeleton className="h-10 w-44" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-3 w-24" />
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton key={j} className="h-9 w-full" />
              ))}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-16 md:h-[76px] border-b bg-card px-4 md:px-8 flex items-center justify-between gap-6">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-9 w-64 max-w-[45%]" />
          </div>
          <div className="p-4 md:p-8 space-y-6">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
            {layout ? (
              <div className="space-y-6">
                <div className="overflow-x-auto border-b pb-3">
                  <div className="flex min-w-max gap-1 rounded-lg bg-muted p-1">
                    {layout.tabs.map(([id, label]) => (
                      <div
                        key={id}
                        className={`min-h-10 px-4 py-2 text-sm ${id === active ? "rounded-md bg-background shadow-sm" : "text-muted-foreground"}`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
                <TabSectionSkeleton
                  section={active!}
                  domestic={layout.domestic}
                />
              </div>
            ) : (
              <SectionPlaceholder fields={9} />
            )}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
export function AuthFormSkeleton() {
  return (
    <LoadingRegion label="Loading sign-in…">
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-[46px] w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-px flex-1" />
          <Skeleton className="h-3 w-5" />
          <Skeleton className="h-px flex-1" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </LoadingRegion>
  );
}

export function ShipmentSkeleton() {
  return (
    <LoadingRegion label="Loading shipment…">
      <div className="space-y-6">
        <Skeleton className="h-6 w-36 rounded-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              className="status-panel rounded-xl border p-6 space-y-4"
              key={i}
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-36 max-w-full" />
            </div>
          ))}
        </div>
        {[3, 6, 5, 6, 6, 3, 4].map((fields, i) => (
          <SectionPlaceholder key={i} fields={fields} />
        ))}
      </div>
    </LoadingRegion>
  );
}
