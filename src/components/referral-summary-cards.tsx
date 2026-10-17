import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminReferralsService,
  type ReferralSummary,
} from "@/services/admin-referrals.service";

export function ReferralSummaryCards() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    adminReferralsService
      .summary(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load referral summary",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  if (error)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 text-sm text-destructive"
      >
        <span>Referral summary unavailable: {error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRevision((value) => value + 1)}
        >
          Retry summary
        </Button>
      </div>
    );
  const cards = [
    {
      title: "Total Referrers",
      value: summary?.totalReferrers.toLocaleString(),
    },
    {
      title: "Total Referrals",
      value: summary?.totalReferrals.toLocaleString(),
    },
    {
      title: "Avg Referrals per Referrer",
      value: summary?.avgReferralsPerReferrer.toFixed(1),
    },
  ];
  return (
    <section
      aria-label="Global referral summary"
      aria-busy={loading}
      className="space-y-2"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold tabular-nums">
                  {card.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          All referrals, independent of table filters and pagination. Counts
          update as referral changes are processed.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh summary
        </Button>
      </div>
    </section>
  );
}
