import { useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminCouponRedemptionMetricsService,
  validateCouponRedemptionQuery,
  type CouponRedemptionMetrics as Metrics,
  type CouponRedemptionQuery,
} from "@/services/admin-coupon-redemption-metrics.service";

export function CouponRedemptionMetrics() {
  const { user, adminType } = useCurrentUser();
  if (adminType !== "super") return null;
  return <RedemptionReport key={user?.id} />;
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
function percentage(value: number | null) {
  return value === null
    ? "Not available"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function defaultIssuanceWeek(now = new Date()): CouponRedemptionQuery {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  const endDate = `${part("year")}-${part("month")}-${part("day")}`;
  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

function RedemptionReport() {
  const [defaults] = useState(defaultIssuanceWeek);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [asOfDate, setAsOfDate] = useState("");
  const [query, setQuery] = useState<CouponRedemptionQuery>(defaults);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    adminCouponRedemptionMetricsService
      .getMetrics(query, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load coupon redemption metrics.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, retry]);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const next = { startDate, endDate, ...(asOfDate ? { asOfDate } : {}) };
    try {
      validateCouponRedemptionQuery(next);
      setFormError("");
      setQuery(next);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Check the selected dates.",
      );
    }
  };
  const gaps = data && Object.values(data.coverage).some((value) => value > 0);

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
      aria-labelledby="coupon-metrics-title"
      aria-busy={loading}
    >
      <div className="space-y-5 border-b p-5 sm:p-6">
        <div>
          <h2 id="coupon-metrics-title" className="font-semibold">
            Issuance cohort
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Track coupons issued during a selected period and their redemptions
            through a cutoff date.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Inclusive calendar dates · Africa/Lagos
          </p>
        </div>
        <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
          {[
            {
              id: "coupon-issued-from",
              label: "Issued from",
              value: startDate,
              change: setStartDate,
              required: true,
            },
            {
              id: "coupon-issued-through",
              label: "Issued through",
              value: endDate,
              change: setEndDate,
              required: true,
            },
            {
              id: "coupon-redemption-cutoff",
              label: "Redemption cutoff (optional)",
              value: asOfDate,
              change: setAsOfDate,
              required: false,
            },
          ].map((field) => (
            <div key={field.id} className="w-full space-y-1.5 sm:w-auto">
              <Label htmlFor={field.id} className="text-xs">
                {field.label}
              </Label>
              <Input
                id={field.id}
                type="date"
                required={field.required}
                value={field.value}
                onChange={(event) => field.change(event.target.value)}
                disabled={loading}
                aria-describedby="coupon-date-help"
                className="w-full [color-scheme:light] dark:[color-scheme:dark] sm:w-48"
              />
            </div>
          ))}
          <Button type="submit" variant="outline" disabled={loading}>
            {loading ? "Loading…" : "View metrics"}
          </Button>
          <p
            id="coupon-date-help"
            className="w-full text-xs text-muted-foreground"
          >
            Leave the cutoff empty to use today in Lagos. It must be on or after
            the issuance end date.
          </p>
          {formError && (
            <p role="alert" className="w-full text-sm text-destructive">
              {formError}
            </p>
          )}
        </form>
      </div>
      {loading ? (
        <p
          role="status"
          className="p-10 text-center text-sm text-muted-foreground"
        >
          Loading redemption metrics…
        </p>
      ) : error ? (
        <div role="alert" className="space-y-3 p-6">
          <p className="break-words text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry metrics
          </Button>
        </div>
      ) : data ? (
        <>
          <div className="space-y-5 p-5 sm:p-6">
            <p className="text-sm text-muted-foreground">
              Issued {dateLabel(data.startDate)} – {dateLabel(data.endDate)} ·
              Redemptions through {dateLabel(data.asOfDate)}
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  title: "Coupon redemption rate",
                  rate: data.couponRedemptionRatePercent,
                  redeemed: data.redeemedCoupons,
                  issued: data.issuedCoupons,
                  unit: "coupons redeemed",
                  empty: "No issued coupons in this cohort.",
                },
                {
                  title: "User redemption rate",
                  rate: data.userRedemptionRatePercent,
                  redeemed: data.usersRedeemedCoupons,
                  issued: data.usersIssuedCoupons,
                  unit: "recipients redeemed at least one coupon",
                  empty: "No eligible recipients in this cohort.",
                },
              ].map((metric) => (
                <div key={metric.title}>
                  <h3 className="text-sm text-muted-foreground">
                    {metric.title}
                  </h3>
                  <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                    {percentage(metric.rate)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {metric.redeemed.toLocaleString()} of{" "}
                    {metric.issued.toLocaleString()} {metric.unit}
                  </p>
                  {metric.rate === null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metric.empty}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <dl className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              {[
                [
                  "Known not redeemed by cutoff",
                  data.notRedeemedByCutoffCoupons,
                ],
                ["Of those, expired unused", data.expiredUnusedCoupons],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {value.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
            {data.issuedCoupons === 0 && (
              <p className="text-sm text-muted-foreground">
                No coupons were issued during this period.
              </p>
            )}
          </div>
          <div className="space-y-3 border-t bg-muted/20 p-5 text-xs text-muted-foreground sm:p-6">
            <h3 className="font-medium text-foreground">Data coverage</h3>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {[
                [
                  "Missing or invalid redemption timestamps",
                  data.coverage.missingRedemptionTimestamp,
                ],
                [
                  "Redemptions before issuance",
                  data.coverage.redemptionBeforeIssuance,
                ],
                ["Invalid recipient IDs", data.coverage.invalidUserId],
                [
                  "Invalid issuance timestamps",
                  data.coverage.invalidIssuanceTimestamp,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt>{label}</dt>
                  <dd className="font-medium tabular-nums">
                    {value.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
            {gaps && (
              <p className="font-medium text-foreground">
                Coverage gaps may understate redemption rates. Invalid recipient
                IDs affect user metrics only.
              </p>
            )}
            <p>
              Used coupons with missing or invalid redemption times remain in
              issued totals but are excluded from redeemed and known-unredeemed
              counts.
            </p>
          </div>
        </>
      ) : (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Choose issuance dates to view redemption metrics.
        </p>
      )}
      <div className="space-y-2 border-t p-5 text-xs text-muted-foreground sm:px-6">
        <p>
          Compare cohorts using a consistent observation window, such as seven
          days after issuance.
        </p>
        <p>
          Reporting may lag updates and backfills. Metrics reflect coupon
          redemption flags; order completion or cancellation does not
          independently change redemption.
        </p>
      </div>
    </section>
  );
}
