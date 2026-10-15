import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw, UserRound } from "lucide-react";
import { useCurrentUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminWeeklyConcentrationService,
  concentrationLimits,
  type WeeklyConcentration,
} from "@/services/admin-weekly-concentration.service";

function calendarLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
function lagosToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const percentage = (value: number) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
export default function WeeklyConcentrationPage() {
  const { user, adminType } = useCurrentUser();
  if (adminType !== "super")
    return (
      <p className="p-6 text-muted-foreground">
        Super admin access is required to view weekly user concentration.
      </p>
    );
  return <ConcentrationReport key={user?.id} />;
}
function ConcentrationReport() {
  const [draft, setDraft] = useState({ top: "10", weekOf: "" });
  const [query, setQuery] = useState({ top: 10, weekOf: "" });
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: WeeklyConcentration;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const requestKey = JSON.stringify([query, revision]);
  const data = result?.key === requestKey ? result.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !data && !error;
  useEffect(() => {
    const controller = new AbortController();
    adminWeeklyConcentrationService
      .getReport(
        { top: query.top, ...(query.weekOf ? { weekOf: query.weekOf } : {}) },
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
                : "Unable to load weekly user concentration",
          });
      });
    return () => controller.abort();
  }, [query, revision, requestKey]);
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery({ top: Number(draft.top), weekOf: draft.weekOf });
  };
  const today = lagosToday();
  const currentWeek = data && data.weekStart <= today && today <= data.weekEnd;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Weekly user concentration
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            See which users account for the most orders in one Lagos calendar
            week.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </header>
      <section
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
        aria-labelledby="concentration-title"
        aria-busy={loading}
      >
        <div className="border-b p-5">
          <h2 id="concentration-title" className="font-semibold">
            Top users by weekly orders
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            All statuses count by order creation date. Includes ride-hailing,
            courier, express shipments, and customs clearance. Restaurant and
            product orders are excluded.
          </p>
          <form
            onSubmit={apply}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="concentration-top" className="text-xs">
                Top users
              </Label>
              <Select
                value={draft.top}
                disabled={loading}
                onValueChange={(top) => setDraft({ ...draft, top })}
              >
                <SelectTrigger id="concentration-top" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {concentrationLimits.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concentration-week" className="text-xs">
                Date within week (optional)
              </Label>
              <Input
                id="concentration-week"
                type="date"
                value={draft.weekOf}
                disabled={loading}
                onChange={(event) =>
                  setDraft({ ...draft, weekOf: event.target.value })
                }
                className="w-44 [color-scheme:light] dark:[color-scheme:dark]"
                aria-describedby="concentration-date-hint"
              />
            </div>
            <Button variant="outline" type="submit" disabled={loading}>
              Apply
            </Button>
          </form>
          <p
            id="concentration-date-hint"
            className="mt-3 text-xs text-muted-foreground"
          >
            Choose any date in the requested week. Leave it empty for the
            current week in Lagos.
          </p>
        </div>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
          >
            <Loader2 className="size-5 shrink-0 animate-spin" />
            <p>
              Loading weekly concentration… High-volume weeks may take several
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
              Retry concentration
            </Button>
          </div>
        ) : (
          data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
                <p className="text-sm text-muted-foreground">
                  {calendarLabel(data.weekStart)} –{" "}
                  {calendarLabel(data.weekEnd)} · Monday–Sunday · Africa/Lagos
                </p>
                {currentWeek && (
                  <Badge variant="secondary">
                    Current week · orders so far
                  </Badge>
                )}
              </div>
              <div className="border-b bg-muted/20 p-5">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
                  {[
                    [
                      "Eligible weekly orders",
                      data.totalRides.toLocaleString(),
                    ],
                    ["Users with orders", data.totalUsers.toLocaleString()],
                    [
                      "Orders from top users",
                      data.topUsersRides.toLocaleString(),
                    ],
                    ["Top users’ share", percentage(data.topUsersSharePercent)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-2xl font-semibold tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  Shares use all eligible weekly orders as the denominator.
                </p>
              </div>
              <div className="flex flex-wrap justify-between gap-2 px-5 py-3 text-xs text-muted-foreground">
                <p>
                  Showing {data.count.toLocaleString()} of{" "}
                  {data.totalUsers.toLocaleString()} users with counted orders ·
                  Top {data.top}
                </p>
                <p>Scroll horizontally to see every service.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead className="sticky left-0 z-10 min-w-44 bg-card">
                      User
                    </TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Weekly share</TableHead>
                    <TableHead className="text-right">Ride-hailing</TableHead>
                    <TableHead className="text-right">Courier</TableHead>
                    <TableHead className="text-right">Express</TableHead>
                    <TableHead className="text-right">
                      Customs clearance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.length ? (
                    data.users.map((user) => (
                      <TableRow key={user.userid}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {user.rank}
                        </TableCell>
                        <TableCell className="sticky left-0 z-10 max-w-64 bg-card">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8 shrink-0">
                              <AvatarImage
                                src={user.imageurl || undefined}
                                alt=""
                              />
                              <AvatarFallback>
                                <UserRound className="size-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <Link
                                to={`/users/${encodeURIComponent(user.userid)}`}
                                className="block max-w-44 truncate font-medium text-primary underline-offset-4 hover:underline"
                                title={user.name || user.userid}
                              >
                                {user.name || "Name unavailable"}
                              </Link>
                              <p
                                className="mt-1 max-w-44 truncate font-mono text-xs text-muted-foreground"
                                title={user.userid}
                              >
                                {user.userid}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {user.totalRides.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percentage(user.sharePercent)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {user.services.ridehailing.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {user.services.courier.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {user.services.expressshipmenr.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {user.services.customclearancer.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        {data.totalRides === 0
                          ? "No eligible orders in this week."
                          : "No users returned for this week."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="space-y-2 border-t bg-muted/20 p-5 text-xs text-muted-foreground">
                <dl className="flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    ["Orders scanned", data.coverage.ordersScanned],
                    ["Invalid customer IDs", data.coverage.invalidCustomerId],
                    ["Unsupported services", data.coverage.unsupportedService],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-1">
                      <dt>{label}:</dt>
                      <dd className="font-medium tabular-nums">
                        {value.toLocaleString()}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  Orders with invalid customer IDs or unsupported shipment types
                  are excluded. Orders without a creation timestamp are
                  excluded.
                </p>
              </div>
            </>
          )
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Ranked by order count, with tied counts ordered by user ID. Users remain
        ranked when profile details are unavailable.
      </p>
    </div>
  );
}
