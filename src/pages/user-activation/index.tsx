import { useCurrentUser } from "@/contexts/UserContext";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  adminTimeToFirstOrderService,
  type ActivationStatus,
  type AdminTimeToFirstOrderResponse,
} from "@/services/admin-time-to-first-order.service";

const statusLabels: Record<ActivationStatus, string> = {
  activated: "Activated",
  no_orders: "No orders",
  invalid_created_at: "Invalid signup date",
  invalid_order_created_at: "Invalid order date",
  order_before_signup: "Order before signup",
};
function dateLabel(value: string | null) {
  if (value === null) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Invalid timestamp"
    : date.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      });
}
function daysLabel(value: number | null) {
  return value === null
    ? "—"
    : `${Math.ceil(value).toLocaleString()} ${Math.ceil(value) === 1 ? "day" : "days"}`;
}

function firstOrderTimeLabel(days: number | null, firstOrderAt: string | null) {
  return days !== null && days >= 0 && days < 1
    ? dateLabel(firstOrderAt)
    : daysLabel(days);
}

export default function UserActivationPage() {
  const { adminType, user } = useCurrentUser();
  if (adminType !== "super")
    return (
      <p className="p-6 text-muted-foreground">
        Super admin access is required to view user activation.
      </p>
    );
  return <UserActivationReport key={user?.id} />;
}

function UserActivationReport() {
  const [lookup, setLookup] = useState("");
  const [query, setQuery] = useState({
    id: "",
    pageSize: 50,
    pageIndex: 0,
    tokens: [undefined] as (string | undefined)[],
  });
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data: AdminTimeToFirstOrderResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const requestKey = JSON.stringify([
    query.id,
    query.pageSize,
    query.pageIndex,
    query.tokens[query.pageIndex],
    revision,
  ]);
  const data = result?.key === requestKey ? result.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !data && !error;
  useEffect(() => {
    const controller = new AbortController();
    const params = query.id
      ? { id: query.id }
      : {
          pageSize: query.pageSize,
          ...(query.tokens[query.pageIndex]
            ? { pageToken: query.tokens[query.pageIndex] }
            : {}),
        };
    adminTimeToFirstOrderService
      .getPage(params, controller.signal)
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
                : "Unable to load user activation",
          });
      });
    return () => controller.abort();
  }, [query, revision, requestKey]);

  const lookupUser = (event: React.FormEvent) => {
    event.preventDefault();
    if (!lookup.trim()) return;
    setQuery((current) => ({
      ...current,
      id: lookup.trim(),
      pageIndex: 0,
      tokens: [undefined],
    }));
    setRevision((current) => current + 1);
  };
  const showAll = () => {
    setLookup("");
    setQuery((current) => ({
      ...current,
      id: "",
      pageIndex: 0,
      tokens: [undefined],
    }));
    setRevision((current) => current + 1);
  };
  const next = () => {
    if (!data?.nextPageToken || query.id) return;
    const token = data.nextPageToken;
    setQuery((current) => ({
      ...current,
      pageIndex: current.pageIndex + 1,
      tokens: [...current.tokens.slice(0, current.pageIndex + 1), token],
    }));
  };
  const summary = data?.pageSummary;
  const global = data?.globalSummary;

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            User activation
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Time from signup to the first order across rides, shipments,
            restaurant, and product orders.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setRevision((current) => current + 1)}
          disabled={loading}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </header>
      <div className="flex items-start gap-2 rounded-lg border bg-secondary/40 px-4 py-3 text-sm text-secondary-foreground">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <p>
          All order statuses count. Overall metrics cover the full dataset; page
          statistics describe only the rows shown. Invalid records are excluded
          from activation rate and average time.
        </p>
      </div>
      <section
        className="overflow-hidden rounded-xl border bg-card"
        aria-label="Activation report"
        aria-busy={loading}
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-semibold">Time to first order</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {query.id
                ? `User lookup: ${query.id}`
                : `Page ${query.pageIndex + 1}`}{" "}
              · Dates shown in Lagos time
            </p>
          </div>
          <form
            onSubmit={lookupUser}
            className="flex w-full flex-wrap gap-2 sm:w-auto"
          >
            <div className="relative min-w-0 flex-1 sm:w-64">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                aria-label="User ID lookup"
                placeholder="Enter an exact user ID…"
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={!lookup.trim() || loading}>
              Look up
            </Button>
            {query.id && (
              <Button type="button" variant="outline" onClick={showAll}>
                Show all users
              </Button>
            )}
          </form>
        </div>
        {global && (
          <div
            className="space-y-4 border-b p-5"
            aria-label="Overall activation summary"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Overall activation</h3>
              <p className="text-xs text-muted-foreground">
                {global.eligibleUsers.toLocaleString()} eligible of{" "}
                {global.totalUsers.toLocaleString()} users
                {!global.isComplete && " · Partial counts"}
              </p>
            </div>
            {!global.isComplete && (
              <p
                role="status"
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" />
                Global metrics unavailable while backfill is in progress. Counts
                may be partial. Refresh to check for updates.
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-5">
              {[
                [
                  "Overall activation rate",
                  !global.isComplete
                    ? "Unavailable"
                    : global.activationRate === null
                      ? "—"
                      : new Intl.NumberFormat(undefined, {
                          style: "percent",
                          maximumFractionDigits: 2,
                        }).format(global.activationRate),
                ],
                [
                  "Overall average time",
                  !global.isComplete
                    ? "Unavailable"
                    : daysLabel(global.averageTimeToFirstOrderDays),
                ],
                ["Activated", global.activatedUsers.toLocaleString()],
                ["No orders", global.noOrderUsers.toLocaleString()],
                ["Invalid records", global.invalidUsers.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-xl font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Live updates are eventually consistent. Last aggregate change:{" "}
              {global.updatedAt ? dateLabel(global.updatedAt) : "Unavailable"}.
            </p>
          </div>
        )}
        {summary && (
          <div className="border-b bg-muted/20 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">
                {query.id ? "Lookup summary" : "Current page summary"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {summary.eligibleUsers.toLocaleString()} eligible of{" "}
                {summary.totalUsers.toLocaleString()} users
              </p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-5">
              {[
                [
                  "Page activation rate",
                  summary.activationRate === null
                    ? "—"
                    : new Intl.NumberFormat(undefined, {
                        style: "percent",
                        maximumFractionDigits: 2,
                      }).format(summary.activationRate),
                ],
                [
                  "Page average time",
                  daysLabel(summary.averageTimeToFirstOrderDays),
                ],
                ["Activated", summary.activatedUsers.toLocaleString()],
                ["No orders", summary.noOrderUsers.toLocaleString()],
                ["Invalid records", summary.invalidUsers.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words text-xl font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin" />
            Loading user activation…
          </div>
        ) : error ? (
          <div role="alert" className="space-y-3 p-8">
            <p className="break-words text-sm text-destructive">{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setRevision((current) => current + 1)}
              >
                Retry
              </Button>
              {!query.id && query.pageIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setQuery((current) => ({
                      ...current,
                      pageIndex: current.pageIndex - 1,
                    }))
                  }
                >
                  Previous page
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Signup date</TableHead>
                <TableHead>First order</TableHead>
                <TableHead>Time to first order</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users.length ? (
                data.users.map((user) => (
                  <TableRow key={user.userid}>
                    <TableCell className="max-w-64">
                      <Link
                        className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                        title={user.userid}
                        to={`/users/${encodeURIComponent(user.userid)}`}
                      >
                        {user.userid}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {dateLabel(user.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {dateLabel(user.firstOrderAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {firstOrderTimeLabel(
                        user.timeToFirstOrderDays,
                        user.firstOrderAt,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === "activated"
                            ? "secondary"
                            : user.status === "no_orders"
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {statusLabels[user.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {query.id
                      ? "No activation record returned for this user."
                      : "No users returned on this page."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {!query.id && (
          <nav
            aria-label="User activation pagination"
            className="flex flex-wrap items-center justify-between gap-4 border-t p-4"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Users per page</span>
              <Select
                value={String(query.pageSize)}
                disabled={loading}
                onValueChange={(value) =>
                  setQuery({
                    id: "",
                    pageSize: Number(value),
                    pageIndex: 0,
                    tokens: [undefined],
                  })
                }
              >
                <SelectTrigger aria-label="Users per page" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 200].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">
              Page {query.pageIndex + 1}
              {data && data.nextPageToken === null ? " · Last page" : ""}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || query.pageIndex === 0}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    pageIndex: current.pageIndex - 1,
                  }))
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
        )}
      </section>
    </div>
  );
}
