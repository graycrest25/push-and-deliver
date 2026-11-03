import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiResponse, queryPath, segment, type RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ActionForm,
  DataList,
  ErrorNotice,
  Heading,
  Notice,
  RecordView,
  ResourcePanel,
  select,
  useResource,
  type ListSpec,
} from "./shared";
const columns = (...keys: string[]) => keys.map((key) => ({ key }));
const page = (path: string, keys: string[]): ListSpec => ({
  path,
  key: "items",
  paging: "cursor",
  columns: columns(...keys),
});
function Back({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link className="text-sm text-primary underline" to={to}>
      {children}
    </Link>
  );
}
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function NativeAccounts({ riders = false }: { riders?: boolean }) {
  const type = riders ? "riders" : "users";
  return (
    <div className="space-y-6">
      <Heading
        title={riders ? "Riders" : "Users"}
        description="Browse account profiles and open a record to inspect its current identity and verification information."
      />
      <DataList
        key={`directory-${type}`}
        spec={{
          ...page("/v1/admin/users", [
            "username",
            "email",
            "phoneNumber",
            "accountType",
            "identityExists",
            "emailVerified",
            "disabled",
            "deleted",
            "verificationStatus",
            "createdAt",
          ]),
          params: { type },
          idKey: "uid",
          link: (row) => `/${type}/${segment(row.uid)}`,
        }}
      />
      <DirectoryExport key={`export-${type}`} riders={riders} />
    </div>
  );
}
export { AccountProfile as NativeAccount } from "./account-profile";
function DirectoryExport({ riders }: { riders: boolean }) {
  const [format, setFormat] = useState("csv"),
    [limit, setLimit] = useState("2000");
  const [cursor, setCursor] = useState(""),
    [downloaded, setDownloaded] = useState(0),
    [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const reset = () => {
    setCursor("");
    setDownloaded(0);
    setFinished(false);
    setError(null);
  };
  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiResponse(
        queryPath(`/v1/admin/reports/${riders ? "riders" : "accounts"}`, {
          ...(riders ? {} : { type: "users" }),
          format,
          limit,
          cursor,
        }),
        {
          headers: {
            Accept: format === "csv" ? "text/csv" : "application/json",
          },
        },
      );
      let blob: Blob,
        next = "";
      if (format === "json") {
        const envelope = await response.json(),
          data = envelope.data;
        if (
          !Array.isArray(data?.items) ||
          typeof data.hasMore !== "boolean" ||
          (data.hasMore && !data.nextCursor)
        )
          throw new Error(
            "The export response is incomplete. Retry this page.",
          );
        next = data.hasMore ? data.nextCursor : "";
        blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
      } else {
        next = response.headers.get("x-next-cursor") || "";
        blob = await response.blob();
      }
      if (next && next === cursor)
        throw new Error(
          "The export repeated its page cursor. Start a fresh export.",
        );
      saveFile(
        blob,
        `${riders ? "riders" : "users"}-${downloaded + 1}.${format}`,
      );
      setDownloaded((n) => n + 1);
      setCursor(next);
      setFinished(!next);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        Export {riders ? "riders" : "users"}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Download the current directory in separate pages. Continue until all
          pages have been downloaded.
        </p>
        <fieldset
          disabled={busy || downloaded > 0}
          className="flex flex-wrap gap-4"
        >
          <label className="space-y-2 text-sm">
            Export format
            <select
              className="block h-10 rounded-md border bg-card px-3"
              value={format}
              onChange={(e) => {
                reset();
                setFormat(e.target.value);
              }}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            Records per export page
            <select
              className="block h-10 rounded-md border bg-card px-3"
              value={limit}
              onChange={(e) => {
                reset();
                setLimit(e.target.value);
              }}
            >
              {[25, 100, 500, 2000].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </fieldset>
        {error != null && <ErrorNotice error={error} />}
        {downloaded > 0 && (
          <p role="status">
            {downloaded} page{downloaded === 1 ? "" : "s"} downloaded.{" "}
            {finished ? "Export complete." : "More records are available."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || finished} onClick={download}>
            {busy
              ? "Downloading…"
              : downloaded
                ? "Download next page"
                : "Download export"}
          </Button>
          {downloaded > 0 && (
            <Button variant="outline" disabled={busy} onClick={reset}>
              Start new export
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
export function NativeRides() {
  return (
    <div className="space-y-6">
      <Heading
        title="Ride hailing & courier"
        description="Inspect rides, assignments, payments and routes across accounts. Records are ordered by ID."
      />
      <DataList
        spec={{
          ...page("/v1/admin/rides", [
            "id",
            "service",
            "rideType",
            "status",
            "customerId",
            "vehicleType",
            "createdAt",
          ]),
          filters: [
            select("status", [
              "",
              "requested",
              "accepted",
              "onroute",
              "completed",
              "cancelled",
              "expired",
              "riderarrived",
            ]),
          ],
          link: (row) => `/ride-hailing/${segment(row.id)}`,
        }}
      />
    </div>
  );
}
export function NativeRide() {
  const { id = "" } = useParams();
  return (
    <div className="space-y-6">
      <Back to="/ride-hailing">Back to rides</Back>
      <Heading title="Ride details" description={id} />
      <ResourcePanel
        title="Ride, route and payment"
        path={`/v1/admin/rides/${segment(id)}`}
      />
      <Notice>
        Ride administration is currently available for inspection. Cancellation
        and assignment changes are unavailable here.
      </Notice>
    </div>
  );
}
const majorMoney = (row: RecordData, key: string) =>
  row[key] == null
    ? "—"
    : new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: row.currency || "NGN",
      }).format(row[key]);
export function NativeFees() {
  const [view, setView] = useState("rides");
  return (
    <div className="space-y-6">
      <Heading
        title="Fees & pricing"
        description="Inspect the current fee records. Monetary components are shown in naira; percentages and multipliers keep their original units."
      />
      <Label htmlFor="fee-view">Fee catalogue</Label>
      <select
        id="fee-view"
        className="h-10 w-full rounded-md border bg-card px-3"
        value={view}
        onChange={(e) => setView(e.target.value)}
      >
        <option value="rides">Ride fares</option>
        <option value="shipping">Shipping settings</option>
      </select>
      <Notice>
        The two catalogues expose the same fee records. Check each fee type and
        any invalid fields before relying on a value. Editing is unavailable
        here.
      </Notice>
      <DataList
        key={view}
        spec={{
          ...page(
            view === "rides"
              ? "/v1/admin/rides/fares"
              : "/v1/admin/shipping/settings",
            [],
          ),
          columns: [
            ...columns("id", "name", "feeType", "moneyUnit"),
            { key: "value", label: "Value (by fee type)" },
            ...[
              "perKm",
              "perMin",
              "perWeight",
              "minFare",
              "bookingFee",
              "addedSurge",
            ].map((key) => ({
              key,
              render: (row: RecordData) => majorMoney(row, key),
            })),
            { key: "surgeMultiplier", label: "Surge multiplier" },
            {
              key: "invalidFields",
              label: "Invalid fields",
              render: (row) => row.invalidFields?.join(", ") || "None",
            },
          ],
        }}
      />
    </div>
  );
}
export function NativeOffices() {
  return (
    <div className="space-y-6">
      <Heading
        title="Head offices"
        description="Inspect shipping-office locations and pickup pricing."
      />
      <DataList
        spec={{
          ...page("/v1/admin/shipping/offices", [
            "id",
            "name",
            "address",
            "basePickupMinor",
            "perKmMinor",
            "active",
          ]),
          params: { includeInactive: true },
          link: (row) => `/head-offices/${segment(row.id)}`,
        }}
      />
    </div>
  );
}
export function NativeOffice() {
  const { id = "" } = useParams();
  return (
    <div className="space-y-6">
      <Back to="/head-offices">Back to offices</Back>
      <Heading title="Office details" />
      <ResourcePanel
        title="Shipping office"
        path={`/v1/admin/shipping/offices/${segment(id)}`}
      />
    </div>
  );
}
export function NativeTariffs({ domestic = false }: { domestic?: boolean }) {
  const root = domestic ? "/delivery-zones" : "/export-rates";
  return (
    <div className="space-y-6">
      <Heading
        title={domestic ? "Delivery tariffs" : "Shipping tariffs"}
        description="Inspect current and historical tariffs, including their weight bands and prices."
      />
      <DataList
        key={root}
        spec={{
          ...page(
            domestic
              ? "/v1/admin/geography/tariffs"
              : "/v1/admin/shipping/tariffs",
            domestic
              ? [
                  "id",
                  "localType",
                  "zone",
                  "status",
                  "volumetricDivisor",
                  "createdAt",
                ]
              : [
                  "id",
                  "name",
                  "carrier",
                  "direction",
                  "cargo",
                  "status",
                  "historical",
                  "createdAt",
                ],
          ),
          params: { includeInactive: true },
          link: (row) => `${root}/tariffs/${segment(row.id)}`,
        }}
      />
      {domestic ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">States & local zones</h2>
          <DataList
            spec={page("/v1/admin/geography/states", [
              "id",
              "name",
              "localZone",
            ])}
          />
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Shipping countries</h2>
          <DataList
            spec={{
              ...page("/v1/admin/shipping/countries", [
                "code",
                "name",
                "active",
                "postalCodeRequired",
              ]),
              params: { includeInactive: true },
              link: (row) => `/export-rates/countries/${segment(row.id)}`,
            }}
          />
        </section>
      )}
    </div>
  );
}
export function NativeTariff({ domestic = false }: { domestic?: boolean }) {
  const { id = "" } = useParams(),
    root = domestic
      ? "/v1/admin/geography/tariffs"
      : "/v1/admin/shipping/tariffs";
  return (
    <div className="space-y-6">
      <Back to={domestic ? "/delivery-zones" : "/export-rates"}>
        Back to tariffs
      </Back>
      <Heading title="Tariff details" description={id} />
      <ResourcePanel title="Tariff" path={`${root}/${segment(id)}`} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Weight bands & prices</h2>
        <DataList
          key={`${root}:${id}`}
          spec={page(
            `${root}/${segment(id)}/rates`,
            domestic
              ? ["weightGrams", "amountMinor", "currency"]
              : ["zone", "weightGrams", "amountMinor", "currency"],
          )}
        />
      </section>
      {!domestic && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Country zones</h2>
          <DataList
            spec={page(`${root}/${segment(id)}/countries`, [
              "code",
              "name",
              "zone",
              "active",
            ])}
          />
        </section>
      )}
    </div>
  );
}
export function NativeCountry() {
  const { id = "" } = useParams();
  return (
    <div className="space-y-6">
      <Back to="/export-rates">Back to shipping configuration</Back>
      <Heading title="Country details" />
      <ResourcePanel
        title="Country"
        path={`/v1/admin/shipping/countries/${segment(id)}`}
      />
    </div>
  );
}
export function NativeAudit() {
  return (
    <div className="space-y-6">
      <Heading
        title="Audit history"
        description="Dashboard and role-management events, ordered by source key. Other subsystems may have separate histories."
      />
      <DataList
        spec={{
          ...page("/v1/admin/audit", []),
          columns: [
            ...columns("id", "source"),
            {
              key: "actor",
              label: "Actor",
              render: (row) => row.actorUid ?? row.actor ?? "—",
            },
            ...columns("targetUid", "action", "adminType", "createdAt"),
          ],
        }}
      />
    </div>
  );
}
const reportNames = [
  "account_summary",
  "order_summary",
  "referral_summary",
  "user_activation",
  "order_facts",
  "coupon_reporting",
];
export function AnalyticsCoverage() {
  const [report, setReport] = useState(reportNames[0]);
  return (
    <div className="space-y-6">
      <Heading
        title="Report coverage"
        description="Check whether reporting data is complete and inspect the latest rebuild before relying on totals."
      />
      <Label htmlFor="coverage-report">Report</Label>
      <select
        id="coverage-report"
        className="h-10 w-full rounded-md border bg-card px-3"
        value={report}
        onChange={(e) => setReport(e.target.value)}
      >
        {reportNames.map((name) => (
          <option key={name} value={name}>
            {name.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <CoverageRecord key={report} report={report} />
    </div>
  );
}
function CoverageRecord({ report }: { report: string }) {
  const resource = useResource(
    queryPath("/v1/admin/analytics/coverage", { report }),
  );
  const [jobId, setJobId] = useState("");
  return (
    <div className="space-y-4">
      <RefreshButton onClick={resource.reload} loading={resource.loading}>
        Refresh coverage
      </RefreshButton>
      {resource.loading && <RecordSkeleton label="Loading report coverage…" />}
      {resource.error != null && (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      )}
      {resource.data && (
        <>
          <Notice>
            {resource.data.coverage?.complete
              ? "This report’s source coverage is complete."
              : "This report is not ready for complete business totals. A rebuild may still be required or processing."}
          </Notice>
          <RecordView data={resource.data} />
          <ActionForm
            action={{
              title: "Queue report rebuild",
              description:
                "Queues a background rebuild of this report. Acceptance does not mean the report is ready; refresh coverage and inspect progress afterward.",
              path: "/v1/admin/analytics/backfills",
              preserveRetry: true,
              body: () => ({ report }),
              success:
                "Report rebuild accepted. Check progress and refresh coverage.",
            }}
            onSuccess={(result) => {
              setJobId(result.jobId);
              resource.reload();
            }}
          />
        </>
      )}
      {jobId && (
        <ResourcePanel
          title="Rebuild progress"
          path={`/v1/operations/${segment(jobId)}`}
        />
      )}
    </div>
  );
}
