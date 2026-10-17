import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAccountSummary,
  type AccountSummary,
  type RiderSummaryGroup,
} from "@/services/account-summary.service";

/** Owns its request and loading/error states, independently of table pagination. */
export function AccountSummaryCards({
  accountType,
  revision = 0,
}: {
  accountType: "users" | "riders";
  revision?: number;
}) {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getAccountSummary(accountType, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Unable to load summary",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accountType, revision, retry]);

  if (error)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 text-sm text-destructive"
      >
        <span>Account summary unavailable: {error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry summary
        </Button>
      </div>
    );

  const vehicles = (group: RiderSummaryGroup) => (
    <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
      <span>Cars: {group.byVehicle[0]}</span>
      <span>Bicycles: {group.byVehicle[1]}</span>
      <span>Bikes: {group.byVehicle[2]}</span>
    </div>
  );
  const cards =
    summary?.type === "users"
      ? [
          {
            title: "Total Users",
            value: summary.total,
            description: "Registered users",
            color: "primary",
          },
          {
            title: "New Today",
            value: summary.newToday,
            description: "Since midnight in Lagos",
            color: "success",
          },
          {
            title: "New This Week",
            value: summary.newThisWeek,
            description: "Last 7 days",
            color: "success",
          },
          {
            title: "Growth Rate",
            value: summary.growthRate === null ? "—" : `${summary.growthRate}%`,
            description:
              summary.growthRate === null
                ? "No users in the previous week"
                : "Week over week",
            color: "primary",
          },
        ]
      : summary?.type === "riders"
        ? [
            {
              title: "Total Riders",
              value: summary.total,
              description: "All registered riders",
              color: "primary",
              group: summary,
            },
            {
              title: "Verified",
              value: summary.verified.total,
              description: "Active verified riders",
              color: "success",
              group: summary.verified,
            },
            {
              title: "Pending",
              value: summary.pending.total,
              description: "Awaiting verification",
              color: "warning",
              group: summary.pending,
            },
            {
              title: "Blocked",
              value: summary.blocked.total,
              description: "Blocked riders",
              color: "destructive",
              group: summary.blocked,
            },
          ]
        : [];
  return (
    <section
      aria-label="All accounts summary"
      aria-busy={loading}
      className="space-y-2"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading
          ? [0, 1, 2, 3].map((key) => (
              <Card key={key}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : cards.map((card) => (
              <Card key={card.title} className="metric-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: `var(--${card.color})` }}
                  >
                    {card.value}
                  </div>
                  {"group" in card && card.group && vehicles(card.group)}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>
      <p className="text-xs text-muted-foreground">
        All {accountType}, independent of table search and pagination. Summary
        may take up to 30 seconds to reflect changes.
      </p>
    </section>
  );
}
