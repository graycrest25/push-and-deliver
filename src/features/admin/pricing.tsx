import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  RecordSkeleton,
  TableSkeleton,
} from "@/components/ui/loading-skeletons";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, queryPath, segment, type RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  return (
    <InformationCard title="Create tariff draft">
      <ActionForm
        action={{
          title: domestic ? "Create local draft" : "Create international draft",
          path: root,
          preserveRetry: true,
          fields: [
            ...(domestic
              ? [
                  field("localType", "Local service ID", {
                    help: "Use a service ID from the local services list below.",
                  }),
                  select("zone", zones, "Local zone"),
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
            }),
            reasonField,
          ],
          body: (values) => ({
            ...values,
            volumetricDivisor: integer(values.volumetricDivisor, 0, 1000000000),
            reason: reason(values.reason),
          }),
        }}
        onSuccess={(data) =>
          navigate(`${sections(domestic)}/tariffs/${segment(data.id)}`)
        }
      />
    </InformationCard>
  );
}
function Rates({ data, domestic }: { data: RecordData; domestic: boolean }) {
  return (
    <div className="max-h-[65vh] overflow-auto rounded-lg border">
      <Table className="min-w-[560px]">
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            {!domestic && <TableHead className="min-w-32">Zone</TableHead>}
            <TableHead className="min-w-48">Weight (grams)</TableHead>
            <TableHead className="min-w-48">Amount (NGN kobo)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rates.map((row: any) => (
            <TableRow key={`${row.zone || 0}:${row.weightGrams}`}>
              {!domestic && <TableCell>{row.zone}</TableCell>}
              <TableCell className="tabular-nums">
                {row.weightGrams.toLocaleString()}
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
  const navigate = useNavigate(),
    root = `${roots(domestic)}/${segment(id)}`,
    path = `${root}/snapshot`;
  return (
    <div className="space-y-6">
      <Link to={sections(domestic)} className="text-primary underline text-sm">
        Back to tariffs
      </Link>
      <Heading title="Tariff details" description={id} />
      {!domestic && (
        <nav
          aria-label="Tariff sections"
          className="flex flex-wrap gap-4 text-sm text-primary"
        >
          <a href="#tariff-prices" className="underline underline-offset-4">
            Destination prices
          </a>
          <a
            href="#tariff-information"
            className="underline underline-offset-4"
          >
            Tariff information
          </a>
          <a href="#tariff-workflow" className="underline underline-offset-4">
            Edit & publish
          </a>
        </nav>
      )}
      <CurrentRecord
        title="Tariff snapshot"
        path={path}
        skeleton={
          <>
            <InformationCard title="Tariff information">
              <RecordSkeleton />
            </InformationCard>
            <InformationCard title="Weight bands & prices">
              <TableSkeleton
                columns={
                  domestic
                    ? ["Weight (grams)", "Amount (NGN kobo)"]
                    : ["Zone", "Destinations", "Weight (kg)", "Price (NGN)"]
                }
                rows={5}
              />
            </InformationCard>
            {!domestic && (
              <InformationCard title="Country zones">
                <RecordSkeleton fields={6} />
              </InformationCard>
            )}
          </>
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
                field("localType", "Local service ID"),
                select("zone", zones, "Local zone"),
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
            }),
          );
          const fence = (values: RecordData) => ({
            expectedVersion: version(data),
            reason: reason(values.reason),
          });
          const minWeight = domestic ? 500 : 1,
            maxWeight = domestic ? 70000 : 100000000;
          const weightFields = [
            ...(!domestic
              ? [field("zone", "Zone", { type: "number", min: 1, max: 100 })]
              : []),
            field("weightGrams", "Weight (grams)", {
              type: "number",
              min: minWeight,
              max: maxWeight,
            }),
          ];
          const validateRows = (values: RecordData, remove: boolean) => {
            if (!values.rates.length || values.rates.length > 200)
              throw new Error("Add between 1 and 200 weight bands.");
            const keys = new Set();
            return values.rates.map((row: RecordData) => {
              const item = {
                ...(!domestic ? { zone: integer(row.zone, 1, 100) } : {}),
                weightGrams: integer(row.weightGrams, minWeight, maxWeight),
                ...(!remove
                  ? { amountMinor: integer(row.amountMinor, 1) }
                  : {}),
              };
              const key = `${row.zone || 0}:${row.weightGrams}`;
              if (keys.has(key))
                throw new Error("Each weight and zone may appear only once.");
              keys.add(key);
              return item;
            });
          };
          const publishIssues: string[] = [];
          if (domestic) {
            const weights = data.rates.map((r: any) => r.weightGrams);
            if (!weights.includes(500) || !weights.includes(70000))
              publishIssues.push(
                "Local publication requires bands at 500 and 70,000 grams.",
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
          return (
            <>
              {domestic ? (
                <InformationCard title="Tariff information">
                  <RecordView data={metadata} />
                </InformationCard>
              ) : (
                <div
                  id="tariff-information"
                  className="scroll-mt-6 space-y-3 rounded-lg border bg-card p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{data.name || data.id}</p>
                    <span className="text-sm capitalize text-muted-foreground">
                      {data.status} · {data.carrier} ·{" "}
                      {String(data.cargo || "").replaceAll("_", " ")}
                    </span>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-primary">
                      View tariff information
                    </summary>
                    <div className="mt-4">
                      <RecordView data={metadata} />
                    </div>
                  </details>
                </div>
              )}
              {domestic ? (
                <InformationCard title="Weight bands & prices">
                  <Rates data={data} domestic />
                </InformationCard>
              ) : (
                <div id="tariff-prices" className="scroll-mt-6">
                  <InternationalTariffPrices
                    data={data}
                    root={root}
                    reload={reload}
                  />
                </div>
              )}
              <div id="tariff-workflow" className="scroll-mt-6">
                <InformationCard title="Draft workflow">
                  <div className="space-y-4">
                    <Notice>
                      New prices apply to new quotes. Accepted shipments and
                      unexpired quotes retain their captured prices. Active and
                      retired tariffs must be cloned before editing.
                    </Notice>
                    {draft && (
                      <>
                        <ActionForm
                          key={`metadata:${data.version}`}
                          onSuccess={receipt(reload)}
                          action={{
                            title: "Save draft information",
                            path: root,
                            method: "PATCH",
                            versionPath: path,
                            preserveRetry: true,
                            initial: data,
                            fields: [...fields, reasonField],
                            body: (values) => ({
                              ...fence(values),
                              changes: requireChanges(
                                changed(
                                  values,
                                  data,
                                  fields.map((f) => f.name),
                                ),
                              ),
                            }),
                          }}
                        />
                        {[false, true].map((remove) => (
                          <ActionForm
                            key={`${remove}:${data.version}`}
                            onSuccess={receipt(reload)}
                            action={{
                              title: remove
                                ? "Delete weight bands"
                                : "Add or update weight bands",
                              path: `${root}/rates`,
                              method: remove ? "DELETE" : "PUT",
                              versionPath: path,
                              preserveRetry: true,
                              description: remove
                                ? "Only the listed keys will be removed from this draft."
                                : "Only these bands are added or changed. Omitted bands are retained.",
                              fields: [
                                field("rates", "Weight bands", {
                                  type: "rows",
                                  fields: [
                                    ...weightFields,
                                    ...(!remove
                                      ? [
                                          moneyField(
                                            "amountMinor",
                                            "Amount (kobo)",
                                          ),
                                        ]
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
                        ))}
                        {!domestic &&
                          [false, true].map((remove) => (
                            <ActionForm
                              key={`countries:${remove}:${data.version}`}
                              onSuccess={receipt(reload)}
                              action={{
                                title: remove
                                  ? "Delete country mappings"
                                  : "Add or update country mappings",
                                path: `${root}/countries`,
                                method: remove ? "DELETE" : "PUT",
                                versionPath: path,
                                preserveRetry: true,
                                fields: [
                                  field("countries", "Country mappings", {
                                    type: "rows",
                                    fields: [
                                      field("code", "Country code", {
                                        pattern: "[A-Z]{2}",
                                        help: "Existing uppercase country code.",
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
                                    throw new Error(
                                      "Add 1–200 unique countries.",
                                    );
                                  if (
                                    new Set(
                                      values.countries.map((c: any) => c.code),
                                    ).size !== values.countries.length
                                  )
                                    throw new Error(
                                      "Country codes must be unique.",
                                    );
                                  return {
                                    ...fence(values),
                                    countries: values.countries,
                                  };
                                },
                              }}
                            />
                          ))}
                        {publishIssues.length ? (
                          <Notice>{publishIssues.join(" ")}</Notice>
                        ) : (
                          <ActionForm
                            key={`publish:${data.version}`}
                            onSuccess={receipt(reload)}
                            action={{
                              title: "Publish reviewed tariff",
                              path: `${root}/publish`,
                              versionPath: path,
                              preserveRetry: true,
                              description:
                                "Publication activates this complete snapshot and retires its predecessor. Review all rates and destinations above.",
                              fields: [reasonField],
                              body: fence,
                            }}
                          />
                        )}
                        <ActionForm
                          key={`archive:${data.version}`}
                          onSuccess={receipt(reload)}
                          action={{
                            title: "Archive unused draft",
                            path: `${root}/archive`,
                            versionPath: path,
                            preserveRetry: true,
                            fields: [reasonField],
                            body: fence,
                          }}
                        />
                      </>
                    )}
                    <ActionForm
                      key={`clone:${data.version}`}
                      onSuccess={(result) =>
                        navigate(
                          `${sections(domestic)}/tariffs/${segment(result.id)}`,
                        )
                      }
                      action={{
                        title: "Clone as a new draft",
                        path: `${root}/clone`,
                        versionPath: path,
                        preserveRetry: true,
                        fields: [reasonField],
                        body: fence,
                      }}
                    />
                  </div>
                </InformationCard>
              </div>
            </>
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
