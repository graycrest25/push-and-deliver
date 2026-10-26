import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/** Render inside TableBody so column headings stay visible during requests. */
export function TableSkeleton({ columns, rows = 10 }: {
  columns: readonly string[];
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} aria-hidden="true" className="hover:bg-transparent">
          {columns.map((width, column) => (
            <TableCell key={column} className="h-12">
              <Skeleton className={`table-skeleton-shimmer h-5 ${width}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
