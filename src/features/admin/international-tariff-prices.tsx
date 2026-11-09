import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, queryPath, type RecordData } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import {
  ActionForm,
  ErrorNotice,
  InformationCard,
  Notice,
  field,
} from "./shared";
import { reason, reasonField, version } from "./workflow-fields";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});
const weight = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 3 });

function amountMinor(value: unknown) {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Enter a positive naira amount with up to two decimal places.",
    );
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000000)
    throw new Error("Enter a price between ₦0.01 and ₦1,000,000,000.");
  return amount;
}

export function InternationalTariffPrices({
  data,
  root,
  reload,
  view = "prices",
}: {
  view?: "prices" | "countries";
  data: RecordData;
  root: string;
  reload: () => void;
}) {
  const [catalogue, setCatalogue] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get("country") || "";
  const [page, setPage] = useState(0);
  const [countryPage, setCountryPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    async function load() {
      const items: RecordData[] = [];
      const visited = new Set<string>();
      let cursor: string | undefined;
      do {
        const result = await api(
          queryPath("/v1/admin/shipping/countries", {
            includeInactive: true,
            limit: DEFAULT_PAGE_SIZE,
            cursor,
          }),
          { signal: controller.signal },
        );
        items.push(...result.items);
        cursor = result.nextCursor || undefined;
        if (cursor && visited.has(cursor))
          throw new Error(
            "Country pagination repeated a cursor. Reload the country list.",
          );
        if (cursor) visited.add(cursor);
      } while (cursor);
      if (!controller.signal.aborted) setCatalogue(items);
    }
    void load()
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  const countries = new Map(
    catalogue.map((country) => [country.code, country]),
  );
  const mappings: RecordData[] = (data.countries || [])
    .map((mapping: RecordData) => ({
      ...mapping,
      name: countries.get(mapping.code)?.name || mapping.code,
      active:
        error || loading ? undefined : countries.get(mapping.code)?.active,
    }))
    .sort((a: RecordData, b: RecordData) => a.name.localeCompare(b.name));
  const destination = mappings.find((country) => country.code === selected);
  const matches = mappings.filter((country) =>
    `${country.name} ${country.code}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const rates: RecordData[] = [...(data.rates || [])]
    .filter(
      (rate) =>
        !selected ||
        (destination && String(rate.zone) === String(destination.zone)),
    )
    .sort(
      (a, b) =>
        Number(a.zone) - Number(b.zone) || a.weightGrams - b.weightGrams,
    );
  const pages = Math.max(1, Math.ceil(rates.length / DEFAULT_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = rates.slice(
    currentPage * DEFAULT_PAGE_SIZE,
    (currentPage + 1) * DEFAULT_PAGE_SIZE,
  );
  const selectCountry = (code: string) => {
    const query = new URLSearchParams(searchParams);
    if (code) query.set("country", code);
    else query.delete("country");
    setSearchParams(query, { replace: true });
    setPage(0);
  };
  const countryPages = Math.max(
    1,
    Math.ceil(matches.length / DEFAULT_PAGE_SIZE),
  );
  const currentCountryPage = Math.min(countryPage, countryPages - 1);
  const visibleCountries = matches.slice(
    currentCountryPage * DEFAULT_PAGE_SIZE,
    (currentCountryPage + 1) * DEFAULT_PAGE_SIZE,
  );

  if (view === "countries")
    return (
      <InformationCard title="Country zones">
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Review country-to-zone mappings and open the prices for a
            destination.
          </p>
          <div className="space-y-2">
            <Label htmlFor="tariff-zone-country-search">Find a country</Label>
            <Input
              id="tariff-zone-country-search"
              placeholder="Search name or country code"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCountryPage(0);
              }}
            />
          </div>
          {error != null && (
            <ErrorNotice
              error={error}
              retry={() => setRevision((value) => value + 1)}
            />
          )}
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border">
            {loading ? (
              <TableSkeleton
                label="Loading country zones…"
                columns={["Country", "Code", "Zone", "Availability", "Prices"]}
                rows={5}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Prices</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCountries.map((country) => (
                    <TableRow key={country.code}>
                      <TableCell>{country.name}</TableCell>
                      <TableCell>{country.code}</TableCell>
                      <TableCell>{country.zone}</TableCell>
                      <TableCell>
                        {country.active === true
                          ? "Available"
                          : country.active === false
                            ? "Disabled"
                            : "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const query = new URLSearchParams(searchParams);
                            query.set("country", country.code);
                            query.set("tab", "prices");
                            setSearchParams(query);
                          }}
                        >
                          View prices for {country.code}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!matches.length && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No matching countries.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <nav
            aria-label="Country zone pagination"
            className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span>
              {matches.length} countries · Page {currentCountryPage + 1} of{" "}
              {countryPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentCountryPage === 0}
                onClick={() => setCountryPage(currentCountryPage - 1)}
              >
                Previous countries
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={currentCountryPage + 1 >= countryPages}
                onClick={() => setCountryPage(currentCountryPage + 1)}
              >
                Next countries
              </Button>
            </div>
          </nav>
        </div>
      </InformationCard>
    );

  return (
    <InformationCard title="International prices">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Choose a destination to see its weight tiers. Countries in the same
          zone share prices.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tariff-country-search">Find a country</Label>
            <Input
              id="tariff-country-search"
              placeholder="Search name or country code"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCountryPage(0);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tariff-destination">Destination country</Label>
            <select
              id="tariff-destination"
              className="h-9 w-full rounded-md border bg-card px-3 text-sm"
              value={selected}
              onChange={(event) => selectCountry(event.target.value)}
            >
              <option value="">All zones</option>
              {matches.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                  {country.active === false ? " · Disabled" : ""}
                </option>
              ))}
              {destination &&
                !matches.some((country) => country.code === selected) && (
                  <option value={selected}>
                    {destination.name} ({selected})
                  </option>
                )}
            </select>
          </div>
        </div>
        {search.trim() && !matches.length && (
          <p role="status" className="text-sm text-muted-foreground">
            No matching countries. Try another name or country code.
          </p>
        )}
        {error != null && (
          <ErrorNotice
            error={error}
            retry={() => setRevision((value) => value + 1)}
          />
        )}
        {loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading country names and availability…
          </p>
        )}
        {destination && (
          <div
            className="flex flex-wrap items-center gap-3 text-sm"
            aria-live="polite"
          >
            <span className="font-semibold">
              {destination.name} · Zone {destination.zone}
            </span>
            <Badge variant="secondary">
              {destination.active === true
                ? "Available"
                : destination.active === false
                  ? "Disabled"
                  : "Availability unknown"}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => selectCountry("")}>
              Show all zones
            </Button>
          </div>
        )}
        {data.status !== "draft" && (
          <p className="text-sm text-muted-foreground">
            To change these prices,{" "}
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set("tab", "workflow");
                setSearchParams(next);
              }}
              className="text-primary underline underline-offset-4"
            >
              clone this tariff as a draft
            </button>
            , edit it, then publish after review.
          </p>
        )}
        <div
          className="max-h-[65vh] overflow-auto rounded-lg border"
          tabIndex={0}
          aria-label="International tariff prices"
        >
          <Table
            aria-label="International tariff prices"
            className="min-w-[300px] md:min-w-[600px]"
          >
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Weight (kg)</TableHead>
                <TableHead className="text-right">Price (NGN)</TableHead>
                <TableHead className="hidden md:table-cell">
                  Destinations
                </TableHead>
                {data.status === "draft" && <TableHead>Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((rate) => {
                const mapped = mappings.filter(
                  (country) => String(country.zone) === String(rate.zone),
                );
                return (
                  <TableRow key={`${rate.zone}:${rate.weightGrams}`}>
                    <TableCell>{rate.zone}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {weight.format(rate.weightGrams / 1000)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {naira.format(rate.amountMinor / 100)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <details>
                        <summary className="cursor-pointer text-sm">
                          {mapped.length}{" "}
                          {mapped.length === 1 ? "country" : "countries"}
                        </summary>
                        <ul className="mt-2 max-w-64 space-y-1 text-sm text-muted-foreground">
                          {mapped.map((country) => (
                            <li key={country.code}>
                              {country.name} ({country.code})
                              {country.active === false ? " · Disabled" : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </TableCell>
                    {data.status === "draft" && (
                      <TableCell className="min-w-60">
                        <ActionForm
                          key={`${data.version}:${rate.zone}:${rate.weightGrams}:${rate.amountMinor}`}
                          onSuccess={reload}
                          action={{
                            title: "Edit price",
                            path: `${root}/rates`,
                            method: "PUT",
                            preserveRetry: true,
                            versionPath: `${root}/snapshot`,
                            description: `Updates the ${weight.format(rate.weightGrams / 1000)} kg tier for every country in zone ${rate.zone}. Other tiers stay unchanged.`,
                            initial: { amountNaira: rate.amountMinor / 100 },
                            fields: [
                              field("amountNaira", "Price (NGN)", {
                                type: "number",
                                min: 0.01,
                                max: 1000000000,
                                step: 0.01,
                              }),
                              reasonField,
                            ],
                            body: (values) => ({
                              expectedVersion: version(data),
                              reason: reason(values.reason),
                              rates: [
                                {
                                  zone: rate.zone,
                                  weightGrams: rate.weightGrams,
                                  amountMinor: amountMinor(values.amountNaira),
                                },
                              ],
                            }),
                          }}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {!visible.length && (
                <TableRow>
                  <TableCell
                    colSpan={data.status === "draft" ? 5 : 4}
                    className="h-28 text-center text-muted-foreground"
                  >
                    No prices for this selection. Choose another country or add
                    weight bands to the draft.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <nav
          aria-label="Price pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span role="status">
            {rates.length} weight tiers · Page {currentPage + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous prices
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next prices
            </Button>
          </div>
        </nav>
        {destination?.active === false && (
          <Notice>
            This country is disabled. Its saved prices are shown for review; it
            is not currently available for shipping.
          </Notice>
        )}
      </div>
    </InformationCard>
  );
}
