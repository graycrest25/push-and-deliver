import { useState } from "react";
import { ApiError, queryPath } from "@/lib/api";
import { metricTone } from "@/lib/data-presentation";
import { Button } from "@/components/ui/button";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  ErrorNotice,
  InformationCard,
  Notice,
  RecordView,
  display,
  useResource,
} from "./shared";

function CoverageCheck() {
  const [inspect, setInspect] = useState(false);
  const resource = useResource(
    inspect ? "/v1/admin/analytics/coverage?report=order_summary" : null,
  );
  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        onClick={() => {
          if (inspect) resource.reload();
          else setInspect(true);
        }}
        disabled={resource.loading}
      >
        Inspect order-summary coverage
      </Button>
      {resource.loading && (
        <RecordSkeleton label="Loading order-summary coverage…" />
      )}
      {resource.error != null && (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      )}
      {resource.data && <RecordView data={resource.data} analytics />}
    </div>
  );
}
export function OrderSummary({ type }: { type: string }) {
  const resource = useResource(
    queryPath("/v1/admin/analytics/order-summary", { type }),
  );
  const data = resource.data;
  const code =
    resource.error instanceof ApiError && resource.error.status === 503
      ? resource.error.code
      : "";
  const counts = [
    ["total", "Total orders"],
    ["active", "Active orders"],
    ["completed", "Completed orders"],
    ["cancelled", "Cancelled orders"],
    ["paid", "Paid orders"],
    ["unpaid", "Unpaid orders"],
    ["unknownPayment", "Payment state unknown"],
    ["totalRevenueMinor", "Total reported revenue"],
    ["completedRevenueMinor", "Completed-order revenue"],
  ];
  return (
    <InformationCard
      title="Order totals"
      action={
        <RefreshButton loading={resource.loading} onClick={resource.reload}>
          Refresh order totals
        </RefreshButton>
      }
    >
      {resource.loading && (
        <RecordSkeleton label="Loading order totals…" fields={9} />
      )}
      {resource.error != null && (
        <div className="space-y-4">
          {code === "analytics_not_ready" && (
            <>
              <h3 className="font-semibold text-[var(--warning)]">
                Report preparation pending
              </h3>
              <p className="text-sm text-muted-foreground">
                Order reporting sources are not ready. Inspect coverage to
                understand the preparation state.
              </p>
            </>
          )}
          {code === "analytics_data_invalid" && (
            <>
              <h3 className="font-semibold text-destructive">
                Order data needs reconciliation
              </h3>
              <p className="text-sm text-muted-foreground">
                The report contains source values that need reconciliation.
                Share the request reference with the backend team.
              </p>
            </>
          )}
          <ErrorNotice
            error={resource.error}
            showReadinessLink={false}
            retry={
              code === "analytics_data_invalid" ? undefined : resource.reload
            }
          />
          {code === "analytics_not_ready" && <CoverageCheck />}
        </div>
      )}
      {data && (
        <div className="space-y-5">
          <dl className="analytics-values grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {counts.map(([key, label]) => {
              const value = data[key];
              const valid =
                typeof value === "number" &&
                Number.isSafeInteger(value) &&
                (key.endsWith("Minor") || value >= 0);
              return (
                <div
                  key={key}
                  className="analytics-metric"
                  data-tone={valid ? metricTone(key, value) : "neutral"}
                >
                  <dt className="text-xs font-semibold">{label}</dt>
                  <dd className={`mt-1 break-words ${valid ? "" : "!text-sm"}`}>
                    {valid
                      ? display(value, key, data.currency || "NGN")
                      : "Unavailable"}
                  </dd>
                </div>
              );
            })}
          </dl>
          {Number.isSafeInteger(data.roundedPaidOrders) &&
            data.roundedPaidOrders > 0 && (
              <Notice>
                Revenue includes{" "}
                {data.roundedPaidOrders.toLocaleString("en-NG")}{" "}
                {data.roundedPaidOrders === 1 ? "order" : "orders"} rounded to
                two decimal places in naira for reporting.
              </Notice>
            )}
          <p className="border-t pt-3 text-xs text-muted-foreground">
            {data.calculatedAt
              ? `Calculated ${display(data.calculatedAt, "calculatedAt")}`
              : "Calculation time unavailable"}{" "}
            · {data.currency || "Currency unavailable"}
          </p>
        </div>
      )}
    </InformationCard>
  );
}
