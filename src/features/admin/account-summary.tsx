import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import {
  IconCalendar,
  IconClock,
  IconCircleCheck,
  IconHistory,
  IconLock,
  IconMinus,
  IconTrendingDown,
  IconTrendingUp,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { metricTone } from "@/lib/data-presentation";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { enumLabel } from "@/lib/enum-labels";
import { queryPath } from "@/lib/api";
import { ErrorNotice, InformationCard, display, useResource } from "./shared";

const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value.toLocaleString("en-NG")
    : "Unavailable";
export function AccountSummary({ type }: { type: "users" | "riders" }) {
  const resource = useResource(
    queryPath("/v1/admin/analytics/account-summary", { type }),
  );
  const data = resource.data;
  const riders = type === "riders";
  const statusTotals = [
    data?.verified?.total,
    data?.pending?.total,
    data?.blocked?.total,
    data?.unknownStatus?.total ?? 0,
  ];
  const riderTotal = statusTotals.every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  )
    ? statusTotals.reduce((total, value) => total + value, 0)
    : undefined;
  const statistics = riders
    ? [
        {
          label: "Total riders",
          key: "total",
          value: riderTotal,
          Icon: IconUsers,
        },
        {
          label: "Verified",
          key: "verified",
          value: data?.verified?.total,
          Icon: IconCircleCheck,
        },
        {
          label: "Pending",
          key: "pending",
          value: data?.pending?.total,
          Icon: IconClock,
        },
        {
          label: "Blocked",
          key: "blocked",
          value: data?.blocked?.total,
          Icon: IconLock,
        },
        {
          label: "Unknown status",
          key: "unknownStatus",
          value: data?.unknownStatus?.total ?? 0,
          Icon: IconMinus,
        },
      ]
    : [
        {
          label: "Total users",
          key: "total",
          value: data?.total,
          Icon: IconUsers,
        },
        {
          label: "New today",
          key: "newToday",
          value: data?.newToday,
          Icon: IconUserPlus,
        },
        {
          label: "New this week",
          key: "newThisWeek",
          value: data?.newThisWeek,
          Icon: IconCalendar,
        },
        {
          label: "New last week",
          key: "newLastWeek",
          value: data?.newLastWeek,
          Icon: IconHistory,
        },
      ];
  const growth = data?.growthRate;
  const growthKnown = typeof growth === "number" && Number.isFinite(growth);
  const GrowthIcon =
    !growthKnown || growth === 0
      ? IconMinus
      : growth > 0
        ? IconTrendingUp
        : IconTrendingDown;
  const vehicles = [
    ...new Set([
      "0",
      "1",
      "2",
      "unknown",
      ...Object.keys(data?.byVehicle || {}),
      ...Object.keys(data?.verified?.byVehicle || {}),
      ...Object.keys(data?.pending?.byVehicle || {}),
      ...Object.keys(data?.blocked?.byVehicle || {}),
      ...Object.keys(data?.unknownStatus?.byVehicle || {}),
    ]),
  ];
  return (
    <InformationCard
      title="Account totals"
      action={
        <RefreshButton loading={resource.loading} onClick={resource.reload}>
          Refresh account totals
        </RefreshButton>
      }
    >
      {resource.loading && (
        <RecordSkeleton label="Loading account totals…" fields={4} />
      )}
      {resource.error != null && (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      )}
      {data && (
        <div className="space-y-5">
          <dl
            className={`analytics-stats grid grid-cols-2 ${riders ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
          >
            {statistics.map(({ label, key, value, Icon }) => (
              <div
                key={label}
                className="analytics-stat min-w-0 space-y-2"
                data-tone={
                  count(value) === "Unavailable"
                    ? "neutral"
                    : metricTone(key, value)
                }
              >
                <dt className="flex items-center gap-2 text-sm">
                  <Icon size={17} stroke={1.8} aria-hidden="true" />
                  {label}
                </dt>
                <dd
                  className={`${count(value) === "Unavailable" ? "text-sm" : "text-2xl font-semibold"} tabular-nums`}
                >
                  {count(value)}
                </dd>
              </div>
            ))}
          </dl>
          {riders && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Riders by vehicle</h3>
              <Table aria-label="Rider counts by vehicle and verification status">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead
                      className="data-tone-text text-right"
                      data-tone="info"
                    >
                      All riders
                    </TableHead>
                    <TableHead
                      className="data-tone-text text-right"
                      data-tone="positive"
                    >
                      Verified
                    </TableHead>
                    <TableHead
                      className="data-tone-text text-right"
                      data-tone="attention"
                    >
                      Pending
                    </TableHead>
                    <TableHead
                      className="data-tone-text text-right"
                      data-tone="danger"
                    >
                      Blocked
                    </TableHead>
                    <TableHead className="text-right">Unknown status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => (
                    <TableRow key={vehicle}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {vehicle === "unknown"
                          ? "Not assigned"
                          : enumLabel("vehicleType", vehicle) ||
                            "Unknown vehicle"}
                      </TableCell>
                      <TableCell
                        className="data-tone-text text-right tabular-nums"
                        data-tone={metricTone(
                          "total",
                          data.byVehicle?.[vehicle],
                        )}
                      >
                        {count(
                          data.byVehicle?.[vehicle] ??
                            (vehicle === "unknown" ? 0 : undefined),
                        )}
                      </TableCell>
                      <TableCell
                        className="data-tone-text text-right tabular-nums"
                        data-tone={metricTone(
                          "verified",
                          data.verified?.byVehicle?.[vehicle],
                        )}
                      >
                        {count(data.verified?.byVehicle?.[vehicle])}
                      </TableCell>
                      <TableCell
                        className="data-tone-text text-right tabular-nums"
                        data-tone={metricTone(
                          "pending",
                          data.pending?.byVehicle?.[vehicle],
                        )}
                      >
                        {count(data.pending?.byVehicle?.[vehicle])}
                      </TableCell>
                      <TableCell
                        className="data-tone-text text-right tabular-nums"
                        data-tone={metricTone(
                          "blocked",
                          data.blocked?.byVehicle?.[vehicle],
                        )}
                      >
                        {count(data.blocked?.byVehicle?.[vehicle])}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {count(data.unknownStatus?.byVehicle?.[vehicle] ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
            <p>
              {data.calculatedAt
                ? `Calculated ${display(data.calculatedAt, "calculatedAt")}`
                : "Calculation time unavailable"}
            </p>
            {!riders && (
              <p>
                Week-over-week growth:{" "}
                <span
                  className="analytics-growth"
                  data-tone={metricTone("growthRate", growth)}
                >
                  <GrowthIcon size={15} aria-hidden="true" />
                  {growthKnown
                    ? `${growth > 0 ? "+" : ""}${growth.toLocaleString("en-NG", { maximumFractionDigits: 1 })}%`
                    : "Unavailable"}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </InformationCard>
  );
}
