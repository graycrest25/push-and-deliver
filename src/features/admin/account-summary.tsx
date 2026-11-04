import { RecordSkeleton } from "@/components/ui/loading-skeletons";
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
  const statistics: [string, unknown][] = riders
    ? [
        ["Total riders", data?.total],
        ["Verified", data?.verified?.total],
        ["Pending", data?.pending?.total],
        ["Blocked", data?.blocked?.total],
      ]
    : [
        ["Total users", data?.total],
        ["New today", data?.newToday],
        ["New this week", data?.newThisWeek],
        ["New last week", data?.newLastWeek],
      ];
  const vehicles = [
    ...new Set([
      "0",
      "1",
      "2",
      ...Object.keys(data?.byVehicle || {}),
      ...Object.keys(data?.verified?.byVehicle || {}),
      ...Object.keys(data?.pending?.byVehicle || {}),
      ...Object.keys(data?.blocked?.byVehicle || {}),
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
          <dl className="grid grid-cols-2 gap-x-5 gap-y-5 rounded-lg bg-muted/40 p-4 lg:grid-cols-4">
            {statistics.map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">{label}</dt>
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
                    <TableHead className="text-right">All riders</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Blocked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => (
                    <TableRow key={vehicle}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {enumLabel("vehicleType", vehicle) || "Unknown vehicle"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {count(data.byVehicle?.[vehicle])}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {count(data.verified?.byVehicle?.[vehicle])}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {count(data.pending?.byVehicle?.[vehicle])}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {count(data.blocked?.byVehicle?.[vehicle])}
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
                {typeof data.growthRate === "number" &&
                Number.isFinite(data.growthRate)
                  ? `${data.growthRate > 0 ? "+" : ""}${data.growthRate.toLocaleString("en-NG", { maximumFractionDigits: 1 })}%`
                  : "Unavailable"}
              </p>
            )}
          </div>
        </div>
      )}
    </InformationCard>
  );
}
