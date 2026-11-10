import { FeatureTabs } from "./feature-tabs";
import { LocalShippingTypes } from "./local-shipping-types";
import { RideDetails, RideDetailsSkeleton } from "./ride-details";
import { RideCommands } from "./ride-commands";
import { enumLabel } from "@/lib/enum-labels";
import {
  CountryPolicy,
  FeeEditor,
  OfficePricing,
  TariffCreate,
  TariffEditor,
} from "./pricing";
import { CurrentRecord } from "./native-dashboard";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import { onlineLabel, riderFilters, RiderExportFilters } from "./rider-filters";
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
  const [exportFilters, setExportFilters] = useState<RecordData>({});
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
          onFiltersChange: setExportFilters,
          ...(riders
            ? {
                filters: riderFilters,
                pairedDates: true,
                note: "Dates include both selected days in Africa/Lagos and filter registration/profile creation. Online status is the saved flag, not a live connectivity check. Browsing includes motorbike and unassigned riders.",
              }
            : {}),
          search: {
            param: "q",
            label: "Search name, email or phone",
            placeholder: "Enter a name, email or phone number",
            help: "Search any part of a name, email or phone number. Names and emails ignore case; phone searches ignore spaces and punctuation.",
          },
          idKey: "uid",
          clickableRows: true,
          link: (row) => `/${type}/${segment(row.uid)}`,
          ...(riders
            ? {
                columns: [
                  ...columns(
                    "username",
                    "email",
                    "phoneNumber",
                    "accountType",
                    "identityExists",
                    "emailVerified",
                    "disabled",
                    "deleted",
                    "verificationStatus",
                  ),
                  {
                    key: "onlineStatus",
                    label: "Online status",
                    render: onlineLabel,
                  },
                  ...columns("createdAt"),
                ],
              }
            : {}),
        }}
      />
      <DirectoryExport
        key={`export-${type}-${JSON.stringify(exportFilters)}`}
        riders={riders}
        initialFilters={exportFilters}
      />
    </div>
  );
}
export { AccountProfile as NativeAccount } from "./account-profile";
function DirectoryExport({
  riders,
  initialFilters,
}: {
  riders: boolean;
  initialFilters: RecordData;
}) {
  const { adminType } = useCurrentUser();
  const [filters, setFilters] = useState(initialFilters);
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  const [format, setFormat] = useState("csv");
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const reset = () => {
    setDownloaded(false);
    setError(null);
  };
  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDownloaded(false);
    const abort = new AbortController();
    controller.current = abort;
    try {
      if (
        !!filters.startDate !== !!filters.endDate ||
        (filters.startDate && filters.startDate > filters.endDate)
      )
        throw new Error(
          "Select both dates, with the end date on or after the start date, or clear both.",
        );
      if (
        filters.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(filters.email.trim())
      )
        throw new Error("Enter a valid exact email address or clear it.");
      const response = await apiResponse(
        queryPath(`/v1/admin/reports/${riders ? "riders" : "users"}`, {
          ...filters,
          // Directory pagination must never truncate a complete export.
          limit: undefined,
          cursor: undefined,
          format,
        }),
        {
          signal: abort.signal,
          headers: {
            Accept: format === "csv" ? "text/csv" : "application/json",
          },
        },
      );
      const blob = await response.blob();
      if (abort.signal.aborted) return;
      saveFile(blob, `${riders ? "riders" : "users"}.${format}`);
      setDownloaded(true);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure);
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  if (!canOperate(adminType)) return null;
  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        Export {riders ? "riders" : "users"}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Download all matching {riders ? "riders" : "users"} in one file. Dates
          use Africa/Lagos. CSV wallet amounts are formatted in NGN. The file is
          saved only after the download completes.
        </p>
        <fieldset disabled={busy} className="flex flex-wrap gap-4">
          <RiderExportFilters
            riders={riders}
            value={filters}
            change={(next) => {
              reset();
              setFilters(next);
            }}
          />
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
        </fieldset>
        {error != null && <ErrorNotice error={error} />}
        {downloaded && <p role="status">Export downloaded.</p>}
        <Button disabled={busy} onClick={download}>
          {busy ? "Downloading…" : "Download export"}
        </Button>
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
            "originCity",
            "rideType",
            "status",
            "customerId",
            "vehicleType",
            "createdAt",
            "dataQuality",
            "unavailableFields",
          ]),
          search: {
            param: "orderId",
            label: "Search ride order ID",
            placeholder: "Paste the full ride ID",
            help: "Exact, case-sensitive match. City and status filters still apply.",
          },
          filters: [
            select("city", ["lagos", "ibadan", "unknown"], "Origin city"),
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
          note: "City filters use the order’s origin. Historical orders without a clear origin city are shown as Unknown.",
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
      <CurrentRecord
        title="Order details"
        path={`/v1/admin/rides/${segment(id)}`}
        skeleton={<RideDetailsSkeleton />}
      >
        {(data, reload) => (
          <>
            <RideCommands key={id} data={data} reload={reload} />
            <RideDetails data={data} />
          </>
        )}
      </CurrentRecord>
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
        Open a fee to inspect normalized units and edit supported pricing
        fields.
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
          link: (row) => `/fees/${segment(row.id)}`,
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
              render: (row) =>
                row.invalidFields
                  ?.map((name: string) =>
                    name.replace(/([a-z])([A-Z])/g, "$1 $2"),
                  )
                  .join(", ") || "None",
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
      <OfficePricing id={id} />
    </div>
  );
}
export function NativeTariffs({ domestic = false }: { domestic?: boolean }) {
  const root = domestic ? "/delivery-zones" : "/export-rates";
  const [includeInactive, setIncludeInactive] = useState(false);
  const tariffs = (
    <div className="space-y-4">
      {!domestic && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Show drafts and retired tariffs
        </label>
      )}
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
          params: domestic || includeInactive ? { includeInactive: true } : {},
          title: domestic
            ? "Delivery tariffs"
            : includeInactive
              ? "All shipping tariffs"
              : "Active shipping tariffs",
          note: domestic
            ? undefined
            : "Open a tariff to find a country and review its prices. Changes stay in a draft until you publish them.",
          link: (row) => `${root}/tariffs/${segment(row.id)}`,
        }}
      />
    </div>
  );
  const states = (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">States & local zones</h2>
      <DataList
        spec={{
          ...page("/v1/admin/geography/states", ["id", "name", "localZone"]),
          link: (row) => `/delivery-zones/states/${segment(row.id)}`,
        }}
      />
    </section>
  );
  const countries = (
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
  );
  return (
    <div className="space-y-6">
      <Heading
        title={domestic ? "Delivery tariffs" : "Shipping tariffs"}
        description={
          domestic
            ? "Manage delivery prices, local shipping types and state zones."
            : "Manage international prices and shipping countries. Open an active DHL export tariff to upload a price-list PDF."
        }
      />
      <FeatureTabs
        key={root}
        label={
          domestic ? "Delivery tariff features" : "Shipping tariff features"
        }
        sections={[
          { id: "tariffs", label: "Tariffs", content: tariffs },
          ...(domestic
            ? [
                {
                  id: "local-types",
                  label: "Local shipping types",
                  content: <LocalShippingTypes />,
                },
                { id: "states", label: "States & zones", content: states },
              ]
            : [{ id: "countries", label: "Countries", content: countries }]),
          {
            id: "create",
            label: "Create tariff",
            content: <TariffCreate domestic={domestic} />,
          },
        ]}
      />
    </div>
  );
}
export function NativeTariff({ domestic = false }: { domestic?: boolean }) {
  return <TariffEditor domestic={domestic} />;
}
export function NativeCountry() {
  const { id = "" } = useParams();
  return (
    <div className="space-y-6">
      <Back to="/export-rates">Back to shipping configuration</Back>
      <Heading title="Country details" />
      <CountryPolicy id={id} />
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
export { ReportCoveragePage as AnalyticsCoverage } from "./report-coverage";
