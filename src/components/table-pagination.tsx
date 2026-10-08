import { SectionHelp } from "@/components/section-help";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, type PageSize } from "@/lib/firestore-pagination";
import type { useFirestorePagination } from "@/hooks/use-firestore-pagination";

export function TablePagination({
  pagination,
  loading = false,
}: {
  pagination: ReturnType<typeof useFirestorePagination>;
  loading?: boolean;
}) {
  const busy = loading || pagination.pending;
  return (
    <nav
      aria-label="Table pagination"
      className="flex flex-wrap items-center justify-between gap-4 px-1 pb-1 pt-5 text-muted-foreground"
    >
      <div className="flex items-center gap-2 text-sm">
        <span>Rows per page</span><SectionHelp title="Table pagination" />
        <Select
          value={String(pagination.pageSize)}
          onValueChange={(value) =>
            pagination.setPageSize(Number(value) as PageSize)
          }
          disabled={busy}
        >
          <SelectTrigger aria-label="Rows per page" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div role="status" className="text-sm tabular-nums">
        {pagination.total === 0 ? (
          busy ? (
            "Loading records…"
          ) : (
            "No records"
          )
        ) : (
          <>
            Page {pagination.pageIndex + 1} of {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString()} documents
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={pagination.previous}
          disabled={busy || pagination.pageIndex === 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={pagination.next}
          disabled={busy || pagination.pageIndex + 1 >= pagination.totalPages}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
