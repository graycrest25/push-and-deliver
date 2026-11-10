import { Skeleton } from "@/components/ui/skeleton";
import {
  TabSectionSkeleton,
  tabPageLayout,
} from "@/components/ui/tab-section-skeleton";
import { FeatureTabs } from "./feature-tabs";
import { TariffPdfImport } from "./tariff-pdf-import";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { SectionHelp } from "@/components/section-help";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, queryPath, segment, type RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enum-labels";
import { InternationalTariffPrices } from "./international-tariff-prices";
import { PricingAuditHistory } from "./pricing-audit-history";
import { CurrentRecord } from "./native-dashboard";
import {
  ActionForm,
  ErrorNotice,
  DataList,
  Heading,
  InformationCard,
  Notice,
  RecordView,
  field,
  select,
  bool,
  type Field,
} from "./shared";
import {
  changed,
  integer,
  moneyField,
  reason,
  reasonField,
  requireChanges,
  version,
} from "./workflow-fields";
const zones = ["abv", "iba", "kad", "los", "phc", "qrw"];
const roots = (domestic: boolean) =>
  domestic ? "/v1/admin/geography/tariffs" : "/v1/admin/shipping/tariffs";
const sections = (domestic: boolean) =>
  domestic ? "/delivery-zones" : "/export-rates";
function useTariffCatalogue(path: string | null) {
  const [items, setItems] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(!!path);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const read = async () => {
      const rows: RecordData[] = [];
      const cursors = new Set<string>();
      let cursor = "";
      do {
        const result = await api(
          queryPath(path, {
            includeInactive: true,
            limit: 100,
            cursor,
          }),
          { signal: controller.signal },
        );
        rows.push(...result.items);
        cursor = result.nextCursor || "";
        if (cursor && cursors.has(cursor))
          throw new Error(
            "The list repeated a page. Reload the available choices.",
          );
        cursors.add(cursor);
      } while (cursor);
      return rows;
    };
    read()
      .then((rows) => {
        if (!controller.signal.aborted) {
          setItems(rows);
          setLoaded(true);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    items,
    loading,
    loaded,
    error,
    reload: () => setRevision((value) => value + 1),
  };
}
function serviceField(services: RecordData[], current?: RecordData): Field {
  const ids = services.map((service) => String(service.id));
  const currentId = String(current?.localType || "");
  if (currentId && !ids.includes(currentId)) ids.push(currentId);
  return field("localType", "Delivery service", {
    type: "select",
    options: ["", ...ids],
    optionLabels: {
      "": "Choose a delivery service",
      ...(currentId
        ? { [currentId]: current?.localTypeName || "Current service" }
        : {}),
      ...Object.fromEntries(
        services.map((service) => [
          service.id,
          `${service.name || service.id}${service.active === false ? " (inactive)" : ""}`,
        ]),
      ),
    },
  });
}
const domesticWeightKg = (value: unknown) => {
  const weight = Number(value);
  if (
    !Number.isFinite(weight) ||
    weight < 0.5 ||
    weight > 70 ||
    Math.round(weight * 1000) / 1000 !== weight
  )
    throw new Error("Enter a weight from 0.5 to 70 kg, in steps of 0.001 kg.");
  return weight;
};
const decimal = (name: string, label: string, max = 100) =>
  field(name, label, {
    type: "number",
    min: 0,
    max,
    step: 0.01,
    required: false,
  });
const receipt = (reload: () => void) => (data: RecordData) => {
  toast.success("Saved. Current prices are being reloaded.");
  if (data.effects?.retiredTariffs?.length)
    toast.info(
      `Retired tariffs: ${data.effects.retiredTariffs.map((v: any) => v.id).join(", ")}`,
    );
  reload();
};
export function FeeEditor() {
  const { id = "" } = useParams(),
    path = `/v1/admin/fees/${segment(id)}`;
  return (
    <div className="space-y-6">
      <Link to="/fees" className="text-primary text-sm underline">
        Back to fees
      </Link>
      <Heading title="Fee details" description={id} />
      <CurrentRecord path={path} title="Fee configuration">
        {(data, reload) => {
          const common = [
            "valueMinor",
            "perKmMinor",
            "perMinMinor",
            "minFareMinor",
            "bookingFeeMinor",
            "surgeMultiplier",
            "addedSurgeMultiplier",
          ];
          const keys = [2, 6, 7].includes(data.feeType)
            ? common
            : data.feeType === 3
              ? [
                  "valueMinor",
                  "perKmMinor",
                  "perWeightMinor",
                  "minFareMinor",
                  "bookingFeeMinor",
                  "surgeMultiplier",
                ]
              : data.feeType === 4
                ? ["valueMinor", "perKmMinor"]
                : data.feeType === 5
                  ? ["valuePpm"]
                  : [];
          const fields = keys.map((key) =>
            key.includes("Multiplier")
              ? decimal(
                  key,
                  key === "addedSurgeMultiplier"
                    ? "Cash addition multiplier"
                    : "Surge multiplier",
                )
              : key === "valuePpm"
                ? field(key, "Rider share (parts per million)", {
                    type: "number",
                    min: 0,
                    max: 1000000,
                    required: false,
                    help: "800000 = 80%.",
                  })
                : moneyField(
                    key,
                    key
                      .replace(/Minor$/, "")
                      .replace(/([a-z])([A-Z])/g, "$1 $2") + " (kobo)",
                    false,
                    data.feeType === 4 && key === "perKmMinor"
                      ? 100000000
                      : 100000000000,
                  ),
          );
          return (
            <>
              <InformationCard title="Current fee">
                <RecordView data={data} />
              </InformationCard>
              {data.editable && keys.length ? (
                <ActionForm
                  key={data.version}
                  onSuccess={receipt(reload)}
                  action={{
                    title: "Save fee changes",
                    method: "PATCH",
                    path,
                    versionPath: path,
                    preserveRetry: true,
                    initial: data.values,
                    fields: [...fields, reasonField],
                    body: (values) => {
                      const changes = changed(values, data.values, keys);
                      for (const [key, value] of Object.entries(changes)) {
                        if (value === null)
                          throw new Error("Fee values cannot be cleared.");
                        if (!key.includes("Multiplier"))
                          integer(
                            value,
                            0,
                            key === "valuePpm" ? 1000000 : 100000000000,
                          );
                      }
                      return {
                        expectedVersion: version(data),
                        reason: reason(values.reason),
                        changes: requireChanges(changes),
                      };
                    },
                  }}
                />
              ) : (
                <Notice>This fee type is available for inspection only.</Notice>
              )}
            </>
          );
        }}
      </CurrentRecord>
    </div>
  );
}
export function OfficePricing({ id }: { id: string }) {
  const path = `/v1/admin/shipping/offices/${segment(id)}`;
  return (
    <CurrentRecord title="Shipping office" path={path}>
      {(data, reload) => (
        <>
          <RecordView data={data} />
          <ActionForm
            key={data.version}
            onSuccess={receipt(reload)}
            action={{
              title: "Update pickup prices",
              method: "PATCH",
              path: `${path}/pricing`,
              versionPath: path,
              preserveRetry: true,
              initial: data,
              fields: [
                moneyField("basePickupMinor", "Base pickup (kobo)"),
                moneyField(
                  "perKmMinor",
                  "Per kilometre (kobo)",
                  true,
                  100000000,
                ),
                reasonField,
              ],
              body: (values) => ({
                expectedVersion: version(data),
                basePickupMinor: integer(values.basePickupMinor),
                perKmMinor: integer(values.perKmMinor, 0, 100000000),
                currency: "NGN",
                reason: reason(values.reason),
              }),
            }}
          />
        </>
      )}
    </CurrentRecord>
  );
}
export function CountryPolicy({ id }: { id: string }) {
  const path = `/v1/admin/shipping/countries/${segment(id)}`;
  return (
    <CurrentRecord title="Country policy" path={path}>
      {(data, reload) => (
        <>
          <RecordView data={data} />
          <ActionForm
            key={data.version}
            onSuccess={receipt(reload)}
            action={{
              title: "Save country policy",
              method: "PATCH",
              path,
              versionPath: path,
              preserveRetry: true,
              initial: data,
              fields: [
                bool("active", "Available for new bookings"),
                bool("postalCodeRequired", "Postal code required"),
                reasonField,
              ],
              body: (values) => ({
                expectedVersion: version(data),
                active: values.active,
                postalCodeRequired: values.postalCodeRequired,
                reason: reason(values.reason),
              }),
            }}
          />
        </>
      )}
    </CurrentRecord>
  );
}
async function readState(id: string) {
  let cursor = "";
  const seen = new Set<string>();
  do {
    const page = await api(
      queryPath("/v1/admin/geography/states", { limit: 100, cursor }),
    );
    const record = page.items.find((row: RecordData) => row.id === id);
    if (record) return record;
    const next = page.nextCursor || "";
    if (next && seen.has(next))
      throw new Error("The state listing repeated a cursor. Reload the list.");
    seen.add(next);
    cursor = next;
  } while (cursor);
  throw new Error("This state is no longer available.");
}
export function StatePolicy() {
  const { id = "" } = useParams();
  const [data, setData] = useState<RecordData | null>(null),
    [error, setError] = useState<unknown>(null);
  const reload = () => {
    setError(null);
    readState(id).then(setData).catch(setError);
  };
  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    readState(id)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((value) => {
        if (active) setError(value);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <div className="space-y-6">
      <Link to="/delivery-zones" className="text-primary underline text-sm">
        Back to delivery tariffs
      </Link>
      <Heading title="State zone policy" description={id} />
      <InformationCard title="State mapping">
        {error ? (
          <ErrorNotice error={error} retry={reload} />
        ) : data ? (
          <div className="space-y-4">
            <RecordView data={data} />
            <ActionForm
              key={data.version}
              onSuccess={receipt(reload)}
              action={{
                title: "Save state zone",
                method: "PATCH",
                path: `/v1/admin/geography/states/${segment(id)}`,
                versionRead: () => readState(id),
                preserveRetry: true,
                initial: data,
                fields: [select("localZone", zones, "Local zone"), reasonField],
                body: (values) => ({
                  expectedVersion: version(data),
                  localZone: values.localZone,
                  reason: reason(values.reason),
                }),
              }}
            />
          </div>
        ) : (
          <RecordSkeleton label="Loading state mapping…" />
        )}
      </InformationCard>
    </div>
  );
}
export function TariffCreate({ domestic = false }: { domestic?: boolean }) {
  const navigate = useNavigate();
  const root = roots(domestic);
  const services = useTariffCatalogue(
    domestic ? "/v1/admin/shipping/local-types" : null,
  );
  return (
    <div className="max-w-4xl space-y-4">
      {domestic && (
        <RefreshButton loading={services.loading} onClick={services.reload}>
          Refresh services
        </RefreshButton>
      )}
      {domestic && services.error != null && (
        <ErrorNotice error={services.error} retry={services.reload} />
      )}
      {domestic && !services.loaded ? (
        services.loading ? (
          <RecordSkeleton label="Loading delivery services…" />
        ) : null
      ) : domestic && !services.items.length ? (
        <p className="text-sm text-muted-foreground">
          Create a delivery service in the{" "}
          <Link
            to="/delivery-zones?tab=local-types"
            className="text-primary underline"
          >
            Local shipping types tab
          </Link>{" "}
          before adding its tariff.
        </p>
      ) : (
        <ActionForm
          defaultOpen
          action={{
            title: domestic
              ? "Create local draft"
              : "Create international draft",
            summaryHint:
              "Start a draft, then add prices and publish when ready.",
            path: root,
            preserveRetry: true,
            fields: [
              ...(domestic
                ? [
                    serviceField(services.items),
                    select("zone", zones, "Delivery zone"),
                  ]
                : [
                    field("name", "Tariff name", { maxLength: 200 }),
                    select("carrier", ["dhl"], "Carrier"),
                    select("direction", ["export", "import"], "Direction"),
                    select("cargo", ["document", "non_document"], "Cargo"),
                  ]),
              field("volumetricDivisor", "Volumetric divisor", {
                type: "number",
                min: 0,
                max: 1000000000,
                default: 0,
                help: "Use 0 when this tariff does not charge by volumetric weight.",
              }),
              reasonField,
            ],
            body: (values) => {
              if (
                domestic &&
                !services.items.some(
                  (service) => service.id === values.localType,
                )
              )
                throw new Error(
                  "Choose a delivery service before creating the draft.",
                );
              return {
                ...values,
                volumetricDivisor: integer(
                  values.volumetricDivisor,
                  0,
                  1000000000,
                ),
                reason: reason(values.reason),
              };
            },
          }}
          onSuccess={(data) =>
            navigate(
              `${sections(domestic)}/tariffs/${segment(data.id)}?tab=workflow`,
            )
          }
        />
      )}
    </div>
  );
}
function Rates({ data, domestic }: { data: RecordData; domestic: boolean }) {
  return (
    <div className="max-h-[65vh] overflow-auto rounded-lg border">
      <Table className={domestic ? "min-w-[280px]" : "min-w-[560px]"}>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            {!domestic && <TableHead className="min-w-32">Zone</TableHead>}
            <TableHead className={domestic ? undefined : "min-w-48"}>
              {domestic ? "Weight (kg)" : "Weight (grams)"}
            </TableHead>
            <TableHead className={domestic ? undefined : "min-w-48"}>
              Amount (NGN kobo)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rates.map((row: any, index: number) => (
            <TableRow
              key={`${row.zone || 0}:${(domestic ? row.weightKg : row.weightGrams) ?? `missing-${index}`}`}
            >
              {!domestic && <TableCell>{row.zone}</TableCell>}
              <TableCell className="tabular-nums">
                {(domestic ? row.weightKg : row.weightGrams)?.toLocaleString(
                  "en-NG",
                  { maximumFractionDigits: 3 },
                ) ?? "Unavailable"}
              </TableCell>
              <TableCell className="tabular-nums">
                {row.amountMinor.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          {!data.rates.length && (
            <TableRow>
              <TableCell
                colSpan={domestic ? 2 : 3}
                className="h-32 text-center text-muted-foreground"
              >
                No weight bands in this draft.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
export function TariffEditor({ domestic = false }: { domestic?: boolean }) {
  const { id = "" } = useParams();
  const services = useTariffCatalogue(
    domestic ? "/v1/admin/shipping/local-types" : null,
  );
  const countries = useTariffCatalogue(
    domestic ? null : "/v1/admin/shipping/countries",
  );
  const navigate = useNavigate(),
    root = `${roots(domestic)}/${segment(id)}`,
    path = `${root}/snapshot`;
  return (
    <div className="space-y-6">
      <Link to={sections(domestic)} className="text-primary underline text-sm">
        Back to tariffs
      </Link>
      <Heading title={domestic ? "Delivery tariff" : "Shipping tariff"} />
      <CurrentRecord
        title="Current tariff"
        path={path}
        skeleton={
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between gap-3">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-5 w-48" />
            </div>
            <FeatureTabs
              label={
                domestic
                  ? "Delivery tariff detail sections"
                  : "Shipping tariff detail sections"
              }
              sections={tabPageLayout(
                `${sections(domestic)}/tariffs/${segment(id)}`,
              )!.tabs.map(([id, label]) => ({
                id,
                label,
                content: (
                  <TabSectionSkeleton section={id} domestic={domestic} />
                ),
              }))}
            />
          </div>
        }
      >
        {(data, reload) => {
          const metadata = Object.fromEntries(
            Object.entries(data).filter(
              ([key]) => !["rates", "countries"].includes(key),
            ),
          );
          const draft = data.status === "draft";
          const fields: Field[] = domestic
            ? [
                serviceField(services.items, data),
                select("zone", zones, "Delivery zone"),
              ]
            : [
                field("name", "Name", { maxLength: 200 }),
                select("carrier", ["dhl"], "Carrier"),
                select("direction", ["export", "import"], "Direction"),
                select("cargo", ["document", "non_document"], "Cargo"),
              ];
          fields.push(
            field("volumetricDivisor", "Volumetric divisor", {
              type: "number",
              min: 0,
              max: 1000000000,
              help: "Use 0 when this tariff does not charge by volumetric weight.",
            }),
          );
          const fence = (values: RecordData) => ({
            expectedVersion: version(data),
            reason: reason(values.reason),
          });
          const minWeight = domestic ? 0.5 : 1,
            maxWeight = domestic ? 70 : 100000000;
          const weightFields = [
            ...(!domestic
              ? [field("zone", "Zone", { type: "number", min: 1, max: 100 })]
              : []),
            field(
              domestic ? "weightKg" : "weightGrams",
              domestic ? "Weight (kg)" : "Weight (grams)",
              {
                type: "number",
                min: minWeight,
                max: maxWeight,
                step: domestic ? 0.001 : 1,
              },
            ),
          ];
          const validateRows = (values: RecordData, remove: boolean) => {
            if (!values.rates.length || values.rates.length > 200)
              throw new Error("Add between 1 and 200 weight bands.");
            const keys = new Set();
            return values.rates.map((row: RecordData) => {
              const weight = domestic
                ? domesticWeightKg(row.weightKg)
                : integer(row.weightGrams, minWeight, maxWeight);
              const item = {
                ...(domestic
                  ? { weightKg: weight }
                  : { zone: integer(row.zone, 1, 100), weightGrams: weight }),
                ...(!remove
                  ? { amountMinor: integer(row.amountMinor, 1) }
                  : {}),
              };
              const key = `${"zone" in item ? item.zone : 0}:${weight}`;
              if (keys.has(key))
                throw new Error("Each weight and zone may appear only once.");
              keys.add(key);
              return item;
            });
          };
          const publishIssues: string[] = [];
          if (domestic) {
            const weights = data.rates.map((r: any) => r.weightKg);
            if (!weights.includes(0.5) || !weights.includes(70))
              publishIssues.push(
                "Local publication requires bands at 0.5 and 70 kg.",
              );
          } else {
            const zoneIds = new Set(data.rates.map((r: any) => r.zone));
            for (const zone of zoneIds) {
              if (data.rates.filter((r: any) => r.zone === zone).length < 2)
                publishIssues.push(
                  `Zone ${zone} needs at least two weight bands.`,
                );
              if (!data.countries?.some((c: any) => c.zone === zone))
                publishIssues.push(`Zone ${zone} needs a country mapping.`);
            }
            if (!zoneIds.size)
              publishIssues.push("Add rates before publication.");
            for (const c of data.countries || [])
              if (!zoneIds.has(c.zone))
                publishIssues.push(`Country ${c.code} has no priced zone.`);
          }
          const weightForm = (remove: boolean) => (
            <ActionForm
              key={`rates:${remove}:${data.version}`}
              defaultOpen={!remove}
              onSuccess={receipt(reload)}
              action={{
                title: remove ? "Delete weight bands" : "Edit prices",
                submitLabel: remove ? "Delete weight bands" : "Save prices",
                intent: remove ? "destructive" : undefined,
                summaryHint: remove
                  ? "Remove selected weights from this draft."
                  : "Add a weight and price, or enter an existing weight to update it.",
                description: remove
                  ? "Other weight bands stay unchanged."
                  : "Save your changes here, then review and publish when ready.",
                path: `${root}/rates`,
                method: remove ? "DELETE" : "PUT",
                versionPath: path,
                preserveRetry: true,
                initial: remove ? undefined : { rates: [{}] },
                fields: [
                  field("rates", "Weight bands", {
                    type: "rows",
                    fields: [
                      ...weightFields,
                      ...(!remove
                        ? [moneyField("amountMinor", "Amount (kobo)")]
                        : []),
                    ],
                  }),
                  reasonField,
                ],
                body: (values) => ({
                  ...fence(values),
                  rates: validateRows(values, remove),
                }),
              }}
            />
          );
          const countryForm = (remove: boolean) => {
            if (!remove && countries.loading)
              return <RecordSkeleton label="Loading destination countries…" />;
            if (!remove && countries.error != null)
              return (
                <ErrorNotice error={countries.error} retry={countries.reload} />
              );
            const destinations = new Map<string, string>();
            const addCountry = (country: RecordData) => {
              const code = String(country.code || country.id || "");
              if (!/^[A-Z]{2}$/.test(code)) return;
              const name =
                country.name ||
                countries.items.find((item) => (item.code || item.id) === code)
                  ?.name;
              destinations.set(code, name ? `${name} (${code})` : code);
            };
            if (!remove) countries.items.forEach(addCountry);
            (data.countries || []).forEach(addCountry);
            return (
              <ActionForm
                key={`countries:${remove}:${data.version}`}
                onSuccess={receipt(reload)}
                action={{
                  title: remove
                    ? "Delete country mappings"
                    : "Add or update country mappings",
                  intent: remove ? "destructive" : undefined,
                  summaryHint: remove
                    ? "Remove selected destinations from this draft."
                    : "Choose which price zone each destination uses.",
                  path: `${root}/countries`,
                  method: remove ? "DELETE" : "PUT",
                  versionPath: path,
                  preserveRetry: true,
                  fields: [
                    field("countries", "Country mappings", {
                      type: "rows",
                      fields: [
                        field("code", "Country", {
                          type: "select",
                          options: ["", ...destinations.keys()],
                          optionLabels: {
                            "": "Choose a country",
                            ...Object.fromEntries(destinations),
                          },
                        }),
                        ...(!remove
                          ? [
                              field("zone", "Zone", {
                                type: "number",
                                min: 1,
                                max: 100,
                              }),
                            ]
                          : []),
                      ],
                    }),
                    reasonField,
                  ],
                  body: (values) => {
                    if (
                      !values.countries.length ||
                      values.countries.length > 200
                    )
                      throw new Error("Add 1–200 unique countries.");
                    if (
                      new Set(values.countries.map((c: any) => c.code)).size !==
                      values.countries.length
                    )
                      throw new Error("Country codes must be unique.");
                    return {
                      ...fence(values),
                      countries: values.countries.map((country: RecordData) => {
                        if (!destinations.has(country.code))
                          throw new Error(
                            "Choose a country from the available destinations.",
                          );
                        return {
                          code: country.code,
                          ...(!remove
                            ? { zone: integer(country.zone, 1, 100) }
                            : {}),
                        };
                      }),
                    };
                  },
                }}
              />
            );
          };
          const cloneForm = (
            <ActionForm
              key={`clone:${data.version}`}
              defaultOpen={!draft}
              onSuccess={(result) =>
                navigate(
                  `${sections(domestic)}/tariffs/${segment(result.id)}?tab=workflow`,
                )
              }
              action={{
                title: "Clone as a new draft",
                summaryHint: "Make an editable copy of this tariff.",
                description:
                  "Current prices stay in place until you publish the new draft.",
                path: `${root}/clone`,
                versionPath: path,
                preserveRetry: true,
                fields: [reasonField],
                body: fence,
              }}
            />
          );
          const workflow = (
            <div
              id="tariff-workflow"
              className="max-w-4xl scroll-mt-6 space-y-8"
            >
              {draft ? (
                <>
                  {weightForm(false)}
                  <section aria-label="Tariff settings" className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">
                        Tariff settings
                      </h3>
                      <SectionHelp title="Tariff settings" />
                    </div>
                    {domestic && services.error != null && (
                      <ErrorNotice
                        error={services.error}
                        retry={services.reload}
                      />
                    )}
                    <ActionForm
                      key={`metadata:${data.version}`}
                      onSuccess={receipt(reload)}
                      action={{
                        title: "Tariff details",
                        submitLabel: "Save draft information",
                        summaryHint: domestic
                          ? "Service, delivery zone and volumetric weight."
                          : "Name, carrier, shipment type and volumetric weight.",
                        path: root,
                        method: "PATCH",
                        versionPath: path,
                        preserveRetry: true,
                        initial: data,
                        fields: [...fields, reasonField],
                        body: (values) => {
                          if (domestic && !values.localType)
                            throw new Error(
                              "Choose a delivery service before saving.",
                            );
                          return {
                            ...fence(values),
                            changes: requireChanges(
                              changed(
                                values,
                                data,
                                fields.map((f) => f.name),
                              ),
                            ),
                          };
                        },
                      }}
                    />
                    {!domestic && countryForm(false)}
                  </section>
                  <section
                    aria-label="Publish changes"
                    className="border-t pt-6"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">
                        Publish changes
                      </h3>
                      <SectionHelp title="Publish changes" />
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      Review the Prices tab before publishing. New prices apply
                      to new quotes; accepted shipments and unexpired quotes
                      keep their prices.
                    </p>
                    {publishIssues.length ? (
                      <div className="mt-4">
                        <Notice>{publishIssues.join(" ")}</Notice>
                      </div>
                    ) : (
                      <ActionForm
                        key={`publish:${data.version}`}
                        onSuccess={receipt(reload)}
                        action={{
                          title: "Publish reviewed tariff",
                          summaryHint:
                            "Make this draft active and retire the previous tariff.",
                          path: `${root}/publish`,
                          versionPath: path,
                          preserveRetry: true,
                          fields: [reasonField],
                          body: fence,
                        }}
                      />
                    )}
                  </section>
                  <section
                    aria-label="Other tariff actions"
                    className="border-t pt-6"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">Other actions</h3>
                      <SectionHelp title="Other tariff actions" />
                    </div>
                    {cloneForm}
                    {weightForm(true)}
                    {!domestic && countryForm(true)}
                    <ActionForm
                      key={`archive:${data.version}`}
                      onSuccess={receipt(reload)}
                      action={{
                        title: "Archive unused draft",
                        intent: "destructive",
                        summaryHint:
                          "Retire this draft without publishing its prices.",
                        path: `${root}/archive`,
                        versionPath: path,
                        preserveRetry: true,
                        fields: [reasonField],
                        body: fence,
                      }}
                    />
                  </section>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    This tariff is {data.status}. Create a draft copy to change
                    its prices.
                  </p>
                  {cloneForm}
                </div>
              )}
            </div>
          );
          const localType =
            typeof data.localType === "string" &&
            data.localType.length <= 40 &&
            /^[a-z]+(?:[_ -][a-z]+)*$/i.test(data.localType)
              ? enumLabel("localType", data.localType)
              : undefined;
          const tariffName =
            data.name ||
            (domestic
              ? [
                  data.localTypeName ||
                    services.items.find(
                      (service) => service.id === data.localType,
                    )?.name ||
                    localType ||
                    "Delivery tariff",
                  enumLabel("zone", data.zone),
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Shipping tariff");
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 break-words font-semibold">
                  {tariffName}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {!domestic && (
                    <span className="text-sm text-muted-foreground">
                      {[
                        enumLabel("carrier", data.carrier) ||
                          String(data.carrier || "").toUpperCase(),
                        enumLabel("cargo", data.cargo),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  <Badge variant="secondary">
                    {enumLabel("status", data.status) || data.status}
                  </Badge>
                </div>
              </div>
              <FeatureTabs
                key={root}
                label={
                  domestic
                    ? "Delivery tariff detail sections"
                    : "Shipping tariff detail sections"
                }
                sections={[
                  {
                    id: "prices",
                    label: "Prices",
                    content: domestic ? (
                      <InformationCard title="Weight bands & prices">
                        <Rates data={data} domestic />
                      </InformationCard>
                    ) : (
                      <InternationalTariffPrices
                        data={data}
                        root={root}
                        reload={reload}
                      />
                    ),
                  },
                  ...(!domestic
                    ? [
                        {
                          id: "country-zones",
                          label: "Country zones",
                          content: (
                            <InternationalTariffPrices
                              data={data}
                              root={root}
                              reload={reload}
                              view="countries"
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    id: "information",
                    label: "Tariff information",
                    content: (
                      <InformationCard title="Tariff information">
                        <RecordView data={metadata} />
                      </InformationCard>
                    ),
                  },
                  ...(!domestic &&
                  data.carrier === "dhl" &&
                  data.direction === "export" &&
                  data.cargo === "non_document"
                    ? [
                        {
                          id: "pdf",
                          label: "PDF upload",
                          content: (
                            <TariffPdfImport
                              data={data}
                              root={root}
                              reload={reload}
                            />
                          ),
                        },
                      ]
                    : []),
                  {
                    id: "workflow",
                    label: "Edit & publish",
                    content: workflow,
                  },
                ]}
              />
            </div>
          );
        }}
      </CurrentRecord>
    </div>
  );
}
export function PricingAudit() {
  return (
    <div className="space-y-6">
      <Heading
        title="Pricing audit"
        description="See who changed pricing, why it changed, and the values recorded before and after each change."
      />
      <CurrentRecord
        title="Latest pricing revision"
        path="/v1/admin/pricing/revision?limit=1"
      >
        {(data) => <RecordView data={data.items} />}
      </CurrentRecord>
      <PricingAuditHistory />
    </div>
  );
}
