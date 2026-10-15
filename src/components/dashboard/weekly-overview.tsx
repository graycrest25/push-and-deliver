import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useCurrentUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminWeeklyOverviewService,
  type WeeklyOverview as WeeklyOverviewData,
} from "@/services/admin-weekly-overview.service";

function calendarLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function WeeklyOverview({ refreshKey }: { refreshKey: number }) {
  const { user, adminType } = useCurrentUser();
  if (adminType !== "super") return null;
  return <WeeklyActivity key={user?.id} refreshKey={refreshKey} />;
}
function WeeklyActivity({ refreshKey }: { refreshKey: number }) {
  const [weeks, setWeeks] = useState("8");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState({ weeks: 8, endDate: "" });
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<WeeklyOverviewData | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    adminWeeklyOverviewService
      .getOverview(
        {
          weeks: query.weeks,
          ...(query.endDate ? { endDate: query.endDate } : {}),
        },
        controller.signal,
      )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load weekly activity",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, refreshKey, retry]);
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(weeks);
    if (!Number.isInteger(value) || value < 1 || value > 52) {
      setFormError("Enter a whole number from 1 to 52 weeks.");
      return;
    }
    setFormError("");
    setQuery({ weeks: value, endDate });
  };
  const partial =
    data && data.weeks[data.weeks.length - 1].weekEnd > data.endDate;
  const hasGaps =
    data &&
    (data.coverage.missingCompletionTimestamp > 0 ||
      data.coverage.missingRiderId > 0);
  const rows =
    data?.weeks.map((week) => ({
      ...week,
      label: `${calendarLabel(week.weekStart)} – ${calendarLabel(week.weekEnd)}`,
    })) ?? [];

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
      aria-labelledby="weekly-activity-title"
      aria-busy={loading}
    >
      <div className="flex flex-wrap items-start justify-between gap-5 border-b p-5 sm:p-6">
        <div>
          <h2 id="weekly-activity-title" className="font-semibold">
            Weekly growth & rider activity
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            New users onboarded and unique riders who completed at least one
            order each week.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Monday–Sunday · Africa/Lagos
          </p>
        </div>
        <form
          onSubmit={apply}
          className="flex w-full flex-wrap items-end gap-3 lg:w-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="overview-weeks" className="text-xs">
              Weeks
            </Label>
            <Input
              id="overview-weeks"
              type="number"
              min={1}
              max={52}
              step={1}
              required
              className="w-20 [color-scheme:light] dark:[color-scheme:dark]"
              value={weeks}
              onChange={(event) => setWeeks(event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="overview-end-date" className="text-xs">
              Through date (optional)
            </Label>
            <Input
              id="overview-end-date"
              type="date"
              className="w-44 [color-scheme:light] dark:[color-scheme:dark]"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              disabled={loading}
              aria-describedby="overview-date-default"
            />
          </div>
          <Button variant="outline" type="submit" disabled={loading}>
            Apply
          </Button>
          <p
            id="overview-date-default"
            className="w-full text-xs text-muted-foreground"
          >
            Leave the date empty to use today in Lagos.
          </p>
          {formError && (
            <p role="alert" className="w-full text-xs text-destructive">
              {formError}
            </p>
          )}
        </form>
      </div>
      {loading ? (
        <p
          role="status"
          className="px-6 py-16 text-center text-sm text-muted-foreground"
        >
          Loading weekly activity…
        </p>
      ) : error ? (
        <div role="alert" className="space-y-3 p-6">
          <p className="break-words text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry weekly activity
          </Button>
        </div>
      ) : (
        data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
              <p className="text-sm text-muted-foreground">
                {calendarLabel(data.startDate)} – {calendarLabel(data.endDate)}{" "}
                inclusive
              </p>
              {partial && (
                <Badge variant="secondary">
                  Final week through {calendarLabel(data.endDate)}
                </Badge>
              )}
            </div>
            <div className="px-2 pb-3 pt-6 sm:px-5">
              <ChartContainer
                className="h-64 w-full aspect-auto"
                config={{
                  newUsers: {
                    label: "New users onboarded",
                    color: "var(--primary)",
                  },
                  activeRiders: {
                    label: "Active riders",
                    color: "var(--success)",
                  },
                }}
              >
                <BarChart
                  accessibilityLayer
                  data={rows}
                  margin={{ left: 0, right: 12 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="weekStart"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                    tickFormatter={(value: string) =>
                      calendarLabel(value).replace(/ \d{4}$/, "")
                    }
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.label || "Week"
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="newUsers"
                    fill="var(--color-newUsers)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="activeRiders"
                    fill="var(--color-activeRiders)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm bg-primary" />
                  New users onboarded
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm bg-[var(--success)]" />
                  Active riders
                </span>
              </div>
            </div>
            <Table className="table-fixed sm:table-auto [&_th]:whitespace-normal [&_td]:whitespace-normal">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2 sm:w-auto">
                    Calendar week
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="sm:hidden">New users</span>
                    <span className="hidden sm:inline">
                      New users onboarded
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Active riders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((week) => (
                  <TableRow key={week.weekStart}>
                    <TableCell className="text-xs sm:text-sm">
                      {week.label}
                      {week.weekEnd > data.endDate && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (partial)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {week.newUsers.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {week.activeRiders.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-2 border-t bg-muted/20 p-5 text-xs text-muted-foreground sm:px-6">
              <dl className="flex flex-wrap gap-x-6 gap-y-2">
                {[
                  [
                    "Completed orders scanned",
                    data.coverage.completedOrdersScanned,
                  ],
                  [
                    "Missing completion timestamps",
                    data.coverage.missingCompletionTimestamp,
                  ],
                  ["Missing rider IDs", data.coverage.missingRiderId],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-1">
                    <dt>{label}:</dt>
                    <dd className="font-medium tabular-nums">
                      {value.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
              {hasGaps && (
                <p className="text-[var(--warning)]">
                  Some completed orders have missing data; active-rider counts
                  may be incomplete.
                </p>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}
