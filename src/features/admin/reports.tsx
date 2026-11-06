import {
  OverviewSkeleton,
  RecordSkeleton,
} from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { queryPath } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Heading,
  ErrorNotice,
  Notice,
  useResource,
  RecordView,
  DataList,
  ResourcePanel,
  InformationCard,
  select,
  field,
  display,
  human,
} from "./shared";
const cols = (...keys: string[]) => keys.map((key) => ({ key }));
export function DashboardPage() {
  const { user, adminType } = useCurrentUser();
  const [dates, setDates] = useState({ from: "", to: "" });
  const [range, setRange] = useState(dates);
  const r = useResource(queryPath("/v1/admin/dashboard", range));
  return (
    <div className="space-y-6">
      <div className="overview-welcome">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back, {user?.username || "Admin"}
          </h1>
          <p className="mt-2 text-sm">
            Your operations workspace, in one place.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["Shipments", "/shipment-orders"],
          ["Support tickets", "/support-tickets"],
          ["Rider applications", "/riders"],
          ["Withdrawals", "/withdrawals"],
          ["Payment review", "/payments"],
        ].map(([label, path]) => (
          <Button key={path} asChild variant="outline">
            <Link to={path}>{label}</Link>
          </Button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setRange(dates);
        }}
      >
        {(["from", "to"] as const).map((key) => (
          <label className="space-y-2 text-sm" key={key}>
            {human(key)} (UTC)
            <Input
              type="date"
              value={dates[key]}
              onChange={(e) => setDates({ ...dates, [key]: e.target.value })}
            />
          </label>
        ))}
        <Button>Apply period</Button>
        <RefreshButton type="button" onClick={r.reload} loading={r.loading}>
          Refresh
        </RefreshButton>
      </form>
      {r.error ? (
        <ErrorNotice error={r.error} retry={r.reload} />
      ) : r.loading ? (
        <OverviewSkeleton />
      ) : (
        r.data && (
          <>
            <p className="text-sm text-muted-foreground">
              Period: {r.data.period?.from} to {r.data.period?.to_exclusive}{" "}
              (exclusive, UTC). Up to 93 days.
            </p>
            <h2 className="text-lg font-semibold">
              Orders created in the period
            </h2>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {["shipments", "marketplace_orders", "rides"].map((key) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">
                      {human(key)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-3xl font-semibold tabular-nums">
                    {display(r.data?.[key])}
                  </CardContent>
                </Card>
              ))}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold tabular-nums">
                  {display(
                    r.data.financials?.revenue_minor,
                    "revenue_minor",
                    r.data.financials?.currency,
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Current operations snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecordView
                  data={Object.fromEntries(
                    Object.entries(r.data).filter(
                      ([key]) =>
                        ![
                          "period",
                          "shipments",
                          "marketplace_orders",
                          "rides",
                          "financials",
                        ].includes(key),
                    ),
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current liabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <RecordView
                  data={{
                    currency: r.data.financials?.currency,
                    wallet_liability_minor:
                      r.data.financials?.wallet_liability_minor,
                    escrow_liability_minor:
                      r.data.financials?.escrow_liability_minor,
                  }}
                />
              </CardContent>
            </Card>
          </>
        )
      )}
      {adminType === "super" && (
        <Button asChild variant="outline">
          <Link to="/weekly-overview">Weekly growth and rider activity</Link>
        </Button>
      )}
    </div>
  );
}
export function AnalyticsPage({
  kind,
}: {
  kind:
    | "weekly-overview"
    | "weekly-concentration"
    | "rider-weekly-deliveries"
    | "time-to-first-order"
    | "coupon-redemptions";
}) {
  const [query, setQuery] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const title = {
    "weekly-overview": "Weekly overview",
    "weekly-concentration": "Weekly concentration",
    "rider-weekly-deliveries": "Rider weekly deliveries",
    "time-to-first-order": "User activation",
    "coupon-redemptions": "Coupon redemption metrics",
  }[kind];
  const fields =
    kind === "weekly-concentration"
      ? [
          select("top", ["10", "20", "50", "100"], "Top users"),
          field("weekOf", "Week containing", { type: "date" }),
        ]
      : kind === "coupon-redemptions"
        ? [
            field("startDate", "Issuance start", { type: "date" }),
            field("endDate", "Issuance end", { type: "date" }),
            field("asOfDate", "Measured as of", {
              type: "date",
              required: false,
            }),
          ]
        : kind === "time-to-first-order"
          ? []
          : [
              field("weeks", "Weeks (1–52)", {
                type: "number",
                min: 1,
                max: 52,
                required: false,
              }),
              field("endDate", "Through date", {
                type: "date",
                required: false,
              }),
            ];
  const path = `/v1/admin/analytics/${kind}`;
  const paged =
    kind === "rider-weekly-deliveries" || kind === "time-to-first-order";
  const ready =
    kind !== "coupon-redemptions" || !!(query.startDate && query.endDate);
  return (
    <div className="space-y-6">
      <Heading
        title={title}
        description="Dates and week boundaries use Africa/Lagos. Coverage information identifies incomplete source evidence."
      />
      {fields.length > 0 && (
        <InformationCard title="Report options">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(draft);
            }}
          >
            {fields.map((f) => (
              <label className="space-y-2 text-sm" key={f.name}>
                {f.label}
                {f.options ? (
                  <select
                    className="block h-10 rounded-md border bg-card px-3"
                    value={draft[f.name] || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [f.name]: e.target.value })
                    }
                  >
                    <option value="">Default</option>
                    {f.options.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={f.type || "text"}
                    min={f.min}
                    max={f.max}
                    required={f.required}
                    value={draft[f.name] || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [f.name]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <Button>Apply report options</Button>
          </form>
        </InformationCard>
      )}
      {ready ? (
        paged ? (
          <DataList
            key={JSON.stringify(query)}
            spec={{
              path,
              title:
                kind === "time-to-first-order"
                  ? "User activation records"
                  : "Rider delivery records",
              params: query,
              key: "items",
              paging: "cursor",
              idKey: kind === "time-to-first-order" ? "userId" : "riderId",
              overviewLoading: (
                <>
                  <InformationCard
                    title={
                      kind === "time-to-first-order"
                        ? "Activation summary"
                        : "Report information"
                    }
                  >
                    <RecordSkeleton
                      fields={kind === "time-to-first-order" ? 7 : 1}
                    />
                  </InformationCard>
                  <InformationCard title="Report coverage">
                    <RecordSkeleton fields={3} />
                  </InformationCard>
                </>
              ),
              overview: (data) => (
                <>
                  {kind === "time-to-first-order" && data.summary && (
                    <InformationCard title="Activation summary">
                      <RecordView data={data.summary} analytics />
                    </InformationCard>
                  )}
                  {data.asOfDate && (
                    <InformationCard title="Report information">
                      <RecordView data={{ asOfDate: data.asOfDate }} />
                    </InformationCard>
                  )}
                  {data.coverage && (
                    <InformationCard title="Report coverage">
                      <RecordView data={data.coverage} />
                    </InformationCard>
                  )}
                </>
              ),
              columns:
                kind === "time-to-first-order"
                  ? cols(
                      "userId",
                      "createdAt",
                      "firstOrderAt",
                      "timeToFirstOrderDays",
                      "status",
                    )
                  : [
                      { key: "riderId", label: "Rider ID" },
                      {
                        key: "completedOrders",
                        label: "Completed orders (shown weeks)",
                        render: (row) =>
                          Array.isArray(row.weeks) &&
                          row.weeks.every(
                            (week: Record<string, unknown>) =>
                              typeof week.completedOrders === "number",
                          )
                            ? row.weeks
                                .reduce(
                                  (
                                    total: number,
                                    week: { completedOrders: number },
                                  ) => total + week.completedOrders,
                                  0,
                                )
                                .toLocaleString()
                            : "—",
                      },
                      {
                        key: "weeks",
                        render: (row) => (
                          <details>
                            <summary className="cursor-pointer">
                              Weekly breakdown
                            </summary>
                            <RecordView data={row.weeks} analytics />
                          </details>
                        ),
                      },
                    ],
              note: "Rows are paginated; summary totals are not limited to the visible page.",
            }}
          />
        ) : (
          <ResourcePanel
            title="Report information"
            path={queryPath(path, query)}
            grouped
            sectionLabels={{
              ...(kind === "weekly-concentration"
                ? { items: "User order concentration" }
                : kind === "weekly-overview"
                  ? { weeks: "Weekly breakdown" }
                  : { cohort: "Issuance period" }),
              coverage: "Report coverage",
            }}
          />
        )
      ) : (
        <Notice>
          Choose an issuance date range to load redemption metrics.
        </Notice>
      )}
    </div>
  );
}
export function AuditPage() {
  return (
    <div className="space-y-6">
      <Heading
        title="Audit history"
        description="Immutable administrative events, ordered by event ID."
      />
      <DataList
        spec={{
          path: "/v1/admin/audit",
          key: "events",
          paging: "after-id",
          columns: [
            ...cols("id", "actor_id", "target_id", "action", "created_at"),
            {
              key: "details",
              render: (r) => (
                <details>
                  <summary className="cursor-pointer">Details</summary>
                  <RecordView data={r.details} />
                </details>
              ),
            },
          ],
        }}
      />
    </div>
  );
}
