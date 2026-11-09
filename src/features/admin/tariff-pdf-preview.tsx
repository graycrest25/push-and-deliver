import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Notice } from "./shared";
import type { RecordData } from "@/lib/api";

export type PdfPreview = {
  applied: false;
  baseTariffId: string;
  baseVersion: number;
  sourceSha256: string;
  currency: "NGN";
  importedRates: number;
  preservedHigherWeightRates: number;
  maxImportedWeightGrams: number;
  mappedCountries: number;
  preservedUnlistedCountries: number;
  countryChanges: { code: string; previousZone: number | null; zone: number }[];
  rates: { zone: number; weightGrams: number; amountMinor: number }[];
};
export function readPdfPreview(
  result: RecordData,
  tariffId: string,
  version: number,
): PdfPreview {
  const nonnegative = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const zone = (value: unknown) =>
    nonnegative(value) && Number(value) >= 1 && Number(value) <= 8;
  const keys = new Set<string>();
  if (
    result.applied !== false ||
    result.baseTariffId !== tariffId ||
    result.baseVersion !== version ||
    result.currency !== "NGN" ||
    typeof result.sourceSha256 !== "string" ||
    ![
      result.importedRates,
      result.preservedHigherWeightRates,
      result.maxImportedWeightGrams,
      result.mappedCountries,
      result.preservedUnlistedCountries,
    ].every(nonnegative) ||
    !Array.isArray(result.rates) ||
    !result.rates.length ||
    result.rates.length !== result.importedRates ||
    !result.rates.every((rate: RecordData) => {
      if (
        !rate ||
        !zone(rate.zone) ||
        !nonnegative(rate.weightGrams) ||
        !rate.weightGrams ||
        !nonnegative(rate.amountMinor)
      )
        return false;
      const key = `${rate.weightGrams}:${rate.zone}`;
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    }) ||
    !Array.isArray(result.countryChanges) ||
    !result.countryChanges.every(
      (country: RecordData) =>
        country &&
        typeof country.code === "string" &&
        /^[A-Z]{2}$/.test(country.code) &&
        zone(country.zone) &&
        (country.previousZone === null || zone(country.previousZone)),
    )
  )
    throw new Error(
      "The preview is incomplete or does not match the selected tariff and version. Preview the PDF again before publishing.",
    );
  return result as PdfPreview;
}

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function TariffPdfPreview({ preview }: { preview: PdfPreview }) {
  const weights = [
    ...new Set(preview.rates.map((rate) => rate.weightGrams)),
  ].sort((a, b) => a - b);
  const rates = new Map(
    preview.rates.map((rate) => [
      `${rate.weightGrams}:${rate.zone}`,
      rate.amountMinor,
    ]),
  );
  const zones = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="space-y-6">
      <Notice>Preview only. No prices have changed.</Notice>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Prices to import", preview.importedRates],
          [
            "Higher-weight prices preserved",
            preview.preservedHigherWeightRates,
          ],
          [
            "Maximum imported weight",
            `${preview.maxImportedWeightGrams / 1000} kg`,
          ],
          ["Countries mapped", preview.mappedCountries],
          ["Unlisted countries preserved", preview.preservedUnlistedCountries],
          ["Country-zone changes", preview.countryChanges.length],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-label="Imported prices" className="space-y-3">
        <h4 className="font-semibold">Prices to import (₦)</h4>
        <p className="text-sm text-muted-foreground">
          {weights.length} weight bands across eight zones. Scroll to review all
          prices.
        </p>
        <div
          className="max-h-[28rem] overflow-auto rounded-lg border"
          tabIndex={0}
          aria-label="Imported price table"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Weight (kg)</TableHead>
                {zones.map((zone) => (
                  <TableHead
                    key={zone}
                    className="text-right whitespace-nowrap"
                  >
                    Zone {zone}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {weights.map((weight) => (
                <TableRow key={weight}>
                  <TableCell className="font-medium tabular-nums">
                    {weight / 1000}
                  </TableCell>
                  {zones.map((zone) => {
                    const amount = rates.get(`${weight}:${zone}`);
                    return (
                      <TableCell
                        key={zone}
                        className="text-right tabular-nums whitespace-nowrap"
                      >
                        {amount === undefined
                          ? "—"
                          : naira.format(amount / 100)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section aria-label="Country-zone changes" className="space-y-3">
        <h4 className="font-semibold">Country-zone changes</h4>
        {preview.countryChanges.length ? (
          <div
            className="max-h-80 overflow-auto rounded-lg border"
            tabIndex={0}
            aria-label="Country-zone changes table"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Current zone</TableHead>
                  <TableHead>New zone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.countryChanges.map((country) => (
                  <TableRow key={country.code}>
                    <TableCell>{country.code}</TableCell>
                    <TableCell>
                      {country.previousZone ?? "Not mapped"}
                    </TableCell>
                    <TableCell>{country.zone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No country-zone mappings will change.
          </p>
        )}
      </section>
    </div>
  );
}
