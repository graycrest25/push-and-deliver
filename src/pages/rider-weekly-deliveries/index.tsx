import { useTableState } from "@/contexts/TableStateContext";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { useCurrentUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminRiderWeeklyDeliveriesService,
  type RiderWeeklyDeliveries,
} from "@/services/admin-rider-weekly-deliveries.service";

function calendarLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
const firstPage = () => ({
  index: 0,
  tokens: [undefined] as (string | undefined)[],
  endDate: "",
});
export default function RiderWeeklyDeliveriesPage() {
  const { user, adminType } = useCurrentUser();
  if (adminType !== "super")
    return (
      <p className="p-6 text-muted-foreground">
        Super admin access is required to view rider weekly deliveries.
      </p>
    );
  return <DeliveriesReport key={user?.id} />;
}
function DeliveriesReport() {
  const [draft, setDraft] = useTableState("table:draft", {
    weeks: "8",
    endDate: "",
    pageSize: "50",
  });
  const [filters, setFilters] = useTableState("table:filters", {
    weeks: 8,
    endDate: "",
    pageSize: 50,
  });
  const [page, setPage] = useTableState("table:page", firstPage);
  const [revision, setRevision] = useState(0);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<{
    key: string;
    data: RiderWeeklyDeliveries;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const requestKey = JSON.stringify([filters, page, revision]);
  const data = result?.key === requestKey ? result.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !data && !error;
  useEffect(() => {
    const controller = new AbortController();
    const endDate = filters.endDate || page.endDate;
    adminRiderWeeklyDeliveriesService
      .getPage(
        {
          weeks: filters.weeks,
          pageSize: filters.pageSize,
          ...(endDate ? { endDate } : {}),
          ...(page.tokens[page.index]
            ? { pageToken: page.tokens[page.index] }
            : {}),
        },
        controller.signal,
      )
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data });
          setFailure(null);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure({
            key: requestKey,
            message:
              error instanceof Error
                ? error.message
                : "Unable to load rider weekly deliveries",
          });
      });
    return () => controller.abort();
  }, [filters, page, revision, requestKey]);
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const weeks = Number(draft.weeks);
    const pageSize = Number(draft.pageSize);
    if (
      !Number.isInteger(weeks) ||
      weeks < 1 ||
      weeks > 52 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 200
    ) {
      setFormError("Enter 1–52 weeks and 1–200 riders per page.");
      return;
    }
    setFormError("");
    setFilters({ weeks, pageSize, endDate: draft.endDate });
    setPage(firstPage());
  };
  const refresh = () => {
    setPage(firstPage());
    setRevision((value) => value + 1);
  };
  const next = () => {
    if (!data?.nextPageToken) return;
    const token = data.nextPageToken;
    setPage((current) => ({
      index: current.index + 1,
      tokens: [...current.tokens.slice(0, current.index + 1), token],
      endDate: data.endDate,
    }));
  };
  const columns = data?.riders[0]?.weeks ?? [];
  const partial =
    data &&
    columns.length > 0 &&
    columns[columns.length - 1].weekEnd > data.endDate;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Rider weekly deliveries
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Completed orders per rider across passenger rides, courier,
            shipments, restaurant, and product orders.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </header>
      <section
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
        aria-labelledby="rider-deliveries-title"
        aria-busy={loading}
      >
        <div className="border-b p-5">
          <h2 id="rider-deliveries-title" className="font-semibold">
            Completed deliveries by week
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monday–Sunday · Africa/Lagos · Totals cover the selected period
            only.
          </p>
          <form
            onSubmit={apply}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            {(
              [
                ["weeks", "Weeks", 1, 52],
                ["pageSize", "Riders per page", 1, 200],
              ] as const
            ).map(([key, label, min, max]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`deliveries-${key}`} className="text-xs">
                  {label}
                </Label>
                <Input
                  id={`deliveries-${key}`}
                  type="number"
                  min={min}
                  max={max}
                  step={1}
                  required
                  value={draft[key]}
                  disabled={loading}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                  className="w-28 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="deliveries-end-date" className="text-xs">
                Through date (optional)
              </Label>
              <Input
                id="deliveries-end-date"
                type="date"
                value={draft.endDate}
                disabled={loading}
                onChange={(event) =>
                  setDraft({ ...draft, endDate: event.target.value })
                }
                className="w-44 [color-scheme:light] dark:[color-scheme:dark]"
                aria-describedby="deliveries-date-hint"
              />
            </div>
            <Button type="submit" variant="outline" disabled={loading}>
              Apply
            </Button>
          </form>
          <p
            id="deliveries-date-hint"
            className="mt-3 text-xs text-muted-foreground"
          >
            Leave the date empty to use today in Lagos. Date range and page size
            changes restart at page one.
          </p>
          {formError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {formError}
            </p>
          )}
        </div>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
          >
            <Loader2 className="size-5 shrink-0 animate-spin" />
            <p>
              Loading rider deliveries… Large histories may take several
              minutes.
            </p>
          </div>
        ) : error ? (
          <div role="alert" className="space-y-3 p-6">
            <p className="break-words text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              Retry deliveries
            </Button>
          </div>
        ) : (
          data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                <p className="text-sm text-muted-foreground">
                  {calendarLabel(data.startDate)} –{" "}
                  {calendarLabel(data.endDate)} inclusive ·{" "}
                  {data.count.toLocaleString()}{" "}
                  {data.count === 1 ? "rider" : "riders"} on this page
                </p>
                {partial && (
                  <Badge variant="secondary">
                    Final week through {calendarLabel(data.endDate)}
                  </Badge>
                )}
              </div>
              <p className="px-5 py-2 text-xs text-muted-foreground">
                Includes riders with zero completions. Scroll horizontally to
                see all weeks.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-44 bg-card">
                      Rider
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Period total
                    </TableHead>
                    {columns.map((week) => (
                      <TableHead
                        key={week.weekStart}
                        className="min-w-40 text-right"
                      >
                        <span className="block whitespace-nowrap text-xs">
                          {calendarLabel(week.weekStart)}
                        </span>
                        <span className="block whitespace-nowrap text-xs">
                          – {calendarLabel(week.weekEnd)}
                        </span>
                        {week.weekEnd > data.endDate && (
                          <span className="block text-xs text-muted-foreground">
                            Partial week
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.riders.length ? (
                    data.riders.map((rider) => (
                      <TableRow key={rider.riderid}>
                        <TableCell className="sticky left-0 z-10 max-w-56 bg-card">
                          <Link
                            to={`/riders/${encodeURIComponent(rider.riderid)}`}
                            className="block max-w-48 truncate font-medium text-primary underline-offset-4 hover:underline"
                            title={rider.name || rider.riderid}
                          >
                            {rider.name || "Unnamed rider"}
                          </Link>
                          <p
                            className="mt-1 max-w-48 truncate font-mono text-xs text-muted-foreground"
                            title={rider.riderid}
                          >
                            {rider.riderid}
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {rider.totalCompletedDeliveries.toLocaleString()}
                        </TableCell>
                        {columns.map((week) => (
                          <TableCell
                            key={week.weekStart}
                            className="text-right tabular-nums"
                          >
                            {rider.weeks
                              .find(
                                (entry) => entry.weekStart === week.weekStart,
                              )
                              ?.completedDeliveries.toLocaleString() ??
                              "Unavailable"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 2}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        No current riders returned on this page.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="space-y-2 border-t bg-muted/20 p-5 text-xs text-muted-foreground">
                <p>
                  Coverage for this page’s riders across all history:{" "}
                  <span className="font-medium tabular-nums">
                    {data.coverage.completedOrdersScanned.toLocaleString()}
                  </span>{" "}
                  completed orders scanned ·{" "}
                  <span className="font-medium tabular-nums">
                    {data.coverage.missingCompletionTimestamp.toLocaleString()}
                  </span>{" "}
                  missing completion timestamps.
                </p>
                {data.coverage.missingCompletionTimestamp > 0 && (
                  <p className="text-[var(--warning)]">
                    Orders without a completion timestamp are excluded. Order
                    creation dates are not used as substitutes.
                  </p>
                )}
              </div>
            </>
          )
        )}
        <nav
          aria-label="Rider deliveries pagination"
          className="flex flex-wrap items-center justify-between gap-3 border-t p-4"
        >
          <p className="text-sm tabular-nums text-muted-foreground">
            Page {page.index + 1}
            {data?.nextPageToken === null ? " · Last page" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page.index === 0}
              onClick={() =>
                setPage((current) => ({ ...current, index: current.index - 1 }))
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !data?.nextPageToken}
              onClick={next}
            >
              Next
            </Button>
          </div>
        </nav>
      </section>
      <p className="text-xs text-muted-foreground">
        Riders are paginated by document ID. Results can change between
        requests; Refresh starts again at page one. Deleted rider accounts are
        excluded.
      </p>
    </div>
  );
}
