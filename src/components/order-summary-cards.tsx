import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOrderSummary,
  type OrderSummary,
  type OrderSummaryType,
} from "@/services/order-summary.service";

const currency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    amount,
  );
const labels: Record<OrderSummaryType, string> = {
  shipment: "Shipments",
  "ride-courier": "Rides & Courier",
  food: "Food Orders",
  ecommerce: "Ecommerce Orders",
};

/** Requests global metrics without depending on table rows, filters, or pagination. */
export function OrderSummaryCards({
  orderType,
}: {
  orderType: OrderSummaryType;
}) {
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getOrderSummary(orderType, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSummary(result);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load order summary",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [orderType, retry]);

  if (error)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 text-sm text-destructive"
      >
        <span>Order summary unavailable: {error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry summary
        </Button>
      </div>
    );
  const ready = summary?.type === orderType ? summary : null;
  const cards = ready
    ? ready.type === "food"
      ? [
          {
            title: "Total Orders",
            value: ready.total,
            description: "All food orders",
            color: "primary",
          },
          {
            title: "Paid Orders",
            value: ready.paid,
            description: "Confirmed paid orders",
            color: "success",
          },
          {
            title: "Unpaid Orders",
            value: ready.unpaid,
            description: "Confirmed unpaid orders",
            color: "warning",
          },
          {
            title: "Total Revenue",
            value: currency(ready.totalRevenue),
            description: "Paid order totals",
            color: "primary",
          },
        ]
      : [
          {
            title: `Total ${labels[orderType]}`,
            value: ready.total,
            description: "All registered orders",
            color: "primary",
          },
          {
            title:
              orderType === "shipment" ? "Active Shipments" : "Active Orders",
            value: ready.active,
            description: "Currently in progress",
            color: "warning",
          },
          {
            title:
              orderType === "shipment"
                ? "Delivered Shipments"
                : "Completed Orders",
            value: ready.completed,
            description: `${currency(ready.completedRevenue)} in paid order totals`,
            color: "success",
          },
          {
            title: "Cancelled Orders",
            value: ready.cancelled,
            description: "Across all orders",
            color: "destructive",
          },
        ]
    : [];
  return (
    <section
      aria-label={`${labels[orderType]} summary`}
      aria-busy={loading}
      className="space-y-2"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading || !ready
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          All orders, independent of table search, filters, and pagination.
          Updates may take up to 30 seconds.
          {ready &&
            ready.unknownPayment > 0 &&
            ` ${ready.unknownPayment.toLocaleString()} orders have an unknown payment status.`}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => setRetry((value) => value + 1)}
        >
          Refresh summary
        </Button>
      </div>
    </section>
  );
}
