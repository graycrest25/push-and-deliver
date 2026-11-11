import { api, queryPath, type RecordData } from "./api";

export const domesticTariffRoot = "/v1/admin/geography/tariffs";
export const domesticZones = [
  "abv",
  "iba",
  "kad",
  "los",
  "phc",
  "qrw",
] as const;
export type DomesticZone = (typeof domesticZones)[number];
export type ExpectedTariff = {
  zone: DomesticZone;
  tariffId: string;
  expectedVersion: number;
};
export type DomesticMetadata = {
  localType: string;
  reason: string;
  preview: boolean;
  expectedTariffs: ExpectedTariff[];
};
export type DomesticPreview = {
  applied: false;
  localType: string;
  sourceSha256: string;
  currency: "NGN";
  weightUnit: "kg";
  importedRates: number;
  maxImportedWeightKg: number;
  zoneMapping: { pdfZone: number; zone: DomesticZone }[];
  zones: {
    zone: DomesticZone;
    pdfZone: number;
    baseTariffId: string;
    baseVersion: number;
    importedRates: number;
    changedPrices: number;
    addedPrices: number;
    removedWeightBandsKg: number[];
    preservedHigherWeightRates: number;
  }[];
  rates: {
    zone: DomesticZone;
    weightKg: number;
    weightGrams: number;
    amountMinor: number;
    previousAmountMinor: number | null;
  }[];
};

export async function loadDomesticTariffs(
  signal?: AbortSignal,
): Promise<RecordData[]> {
  const rows: RecordData[] = [];
  const seen = new Set<string>();
  let cursor = "";
  do {
    const data = await api(
      queryPath(domesticTariffRoot, { limit: 100, cursor }),
      { signal },
    );
    if (!Array.isArray(data.items))
      throw new Error(
        "Unable to read the current tariffs. Reload and try again.",
      );
    rows.push(...data.items);
    cursor = data.nextCursor || "";
    if (cursor && seen.has(cursor))
      throw new Error("The tariff list repeated a page. Reload and try again.");
    seen.add(cursor);
  } while (cursor);
  return rows;
}

export function expectedDomesticTariffs(
  rows: RecordData[],
  localType: string,
): ExpectedTariff[] {
  return domesticZones.map((zone) => {
    const matches = rows.filter(
      (row) =>
        row.status === "active" &&
        row.localType === localType &&
        row.zone === zone,
    );
    const row = matches[0];
    if (
      matches.length !== 1 ||
      typeof row?.id !== "string" ||
      !row.id ||
      !Number.isSafeInteger(row.version) ||
      row.version < 0
    )
      throw new Error(
        `Exactly one active ${zone.toUpperCase()} tariff with an ID and version is required for this service.`,
      );
    return { zone, tariffId: row.id, expectedVersion: row.version };
  });
}

export async function pdfSha256(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function readDomesticPreview(
  value: DomesticPreview,
  metadata: DomesticMetadata,
  hash: string,
): DomesticPreview {
  const invalid = () => {
    throw new Error(
      "The preview is incomplete or does not match this PDF and the six current tariffs. Preview again before publishing.",
    );
  };
  const count = (n: number) => Number.isSafeInteger(n) && n >= 0;
  if (
    !value ||
    value.applied !== false ||
    value.localType !== metadata.localType ||
    value.sourceSha256 !== hash ||
    value.currency !== "NGN" ||
    value.weightUnit !== "kg" ||
    !Array.isArray(value.zones) ||
    value.zones.length !== 6 ||
    !Array.isArray(value.zoneMapping) ||
    value.zoneMapping.length !== 6 ||
    !Array.isArray(value.rates) ||
    !value.rates.length ||
    value.importedRates !== value.rates.length
  )
    return invalid();
  const keys = new Set<string>();
  for (const rate of value.rates) {
    const key = `${rate?.zone}:${rate?.weightGrams}`;
    if (
      !rate ||
      !domesticZones.includes(rate.zone) ||
      !Number.isFinite(rate.weightKg) ||
      rate.weightKg <= 0 ||
      !Number.isSafeInteger(rate.weightGrams) ||
      Math.round(rate.weightKg * 1000) !== rate.weightGrams ||
      !count(rate.amountMinor) ||
      !(rate.previousAmountMinor === null || count(rate.previousAmountMinor)) ||
      keys.has(key)
    )
      return invalid();
    keys.add(key);
  }
  if (
    value.maxImportedWeightKg !==
    Math.max(...value.rates.map((rate) => rate.weightKg))
  )
    return invalid();
  for (const [index, expected] of metadata.expectedTariffs.entries()) {
    const summaries = value.zones.filter(
      (zone) => zone?.zone === expected.zone,
    );
    const summary = summaries[0];
    const rates = value.rates.filter((rate) => rate.zone === expected.zone);
    if (
      summaries.length !== 1 ||
      summary.pdfZone !== index + 1 ||
      summary.baseTariffId !== expected.tariffId ||
      summary.baseVersion !== expected.expectedVersion ||
      !rates.length ||
      summary.importedRates !== rates.length ||
      !count(summary.changedPrices) ||
      !count(summary.addedPrices) ||
      !count(summary.preservedHigherWeightRates) ||
      summary.addedPrices !==
        rates.filter((rate) => rate.previousAmountMinor === null).length ||
      summary.changedPrices !==
        rates.filter(
          (rate) =>
            rate.previousAmountMinor !== null &&
            rate.previousAmountMinor !== rate.amountMinor,
        ).length ||
      !Array.isArray(summary.removedWeightBandsKg) ||
      summary.removedWeightBandsKg.some(
        (weight) => !Number.isFinite(weight) || weight <= 0,
      ) ||
      value.zoneMapping.filter(
        (zone) => zone?.zone === expected.zone && zone.pdfZone === index + 1,
      ).length !== 1
    )
      return invalid();
  }
  return value;
}
