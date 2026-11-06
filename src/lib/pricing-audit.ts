import type { RecordData } from "./api";

export const pricingActionLabel = (action: string) =>
  ({
    "international.archive": "International tariff archived",
    "international.rates": "International prices updated",
    "international.delete-rates": "International prices removed",
    "international.clone": "International tariff cloned",
    "international.publish": "International tariff published",
    "international.countries": "Destination zones updated",
    "international.delete-countries": "Destination zones removed",
    "local.rates": "Local prices updated",
    "local.clone": "Local tariff cloned",
    "local.archive": "Local tariff archived",
    "local.publish": "Local tariff published",
    "catalogue.publish": "Shipping catalogue published",
    "shipping.policy.restore": "Shipping policies restored",
    publish: "Tariff published",
  })[action] ||
  action.replace(/[._-]/g, " ").replace(/^./, (letter) => letter.toUpperCase());

export const auditResourceName = (row: RecordData) =>
  row.after?.name ||
  row.before?.name ||
  row.resourceId ||
  "Unspecified resource";

export function rateChanges(row: RecordData) {
  const key = (rate: RecordData) =>
    `${rate.zone ?? "local"}:${rate.weightGrams}`;
  const before = new Map<string, RecordData>(
    (row.before?.rates || []).map((rate: RecordData) => [key(rate), rate]),
  );
  const after = new Map<string, RecordData>(
    (row.after?.rates || []).map((rate: RecordData) => [key(rate), rate]),
  );
  return [...new Set([...before.keys(), ...after.keys()])]
    .flatMap((id) => {
      const old = before.get(id),
        current = after.get(id);
      if (old && current && old.amountMinor === current.amountMinor) return [];
      const rate = current || old!;
      return [
        {
          id,
          zone: rate.zone,
          weightGrams: rate.weightGrams,
          before: old?.amountMinor,
          after: current?.amountMinor,
          kind: !old ? "Added" : !current ? "Removed" : "Updated",
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(a.zone ?? 0) - Number(b.zone ?? 0) ||
        a.weightGrams - b.weightGrams,
    );
}

export function countryChanges(row: RecordData) {
  const before = new Map<string, RecordData>(
    (row.before?.countries || []).map((country: RecordData) => [
      country.code,
      country,
    ]),
  );
  const after = new Map<string, RecordData>(
    (row.after?.countries || []).map((country: RecordData) => [
      country.code,
      country,
    ]),
  );
  const value = (country: RecordData | undefined) =>
    country && {
      name: country.name,
      zone: country.zone,
      active: country.active,
      postalCodeRequired:
        country.postalCodeRequired ?? country.postal_code_required ?? null,
    };
  return [...new Set([...before.keys(), ...after.keys()])].flatMap((code) => {
    const old = before.get(code),
      current = after.get(code);
    if (
      old &&
      current &&
      JSON.stringify(value(old)) === JSON.stringify(value(current))
    )
      return [];
    return [
      {
        code,
        name: current?.name || old?.name || code,
        before: old,
        after: current,
      },
    ];
  });
}

export function auditSummary(row: RecordData) {
  if (row.action === "catalogue.publish")
    return `${row.after?.internationalRates ?? "—"} international prices · ${row.after?.destinations ?? "—"} destinations`;
  if (row.action === "shipping.policy.restore")
    return `${row.effects?.legacyItemCategories ?? row.after?.itemTypes?.length ?? "—"} item categories · ${row.after?.eligibility?.length ?? "—"} eligibility rules`;
  if (String(row.action).endsWith(".clone"))
    return "New draft created from an existing tariff";
  const changes: string[] = [];
  const rates = rateChanges(row).length,
    countries = countryChanges(row).length;
  if (rates)
    changes.push(`${rates} price ${rates === 1 ? "tier" : "tiers"} changed`);
  if (countries)
    changes.push(
      `${countries} ${countries === 1 ? "country" : "countries"} changed`,
    );
  if (row.before?.status !== row.after?.status && row.after?.status)
    changes.push(`${row.before?.status || "Not set"} → ${row.after.status}`);
  if (!rates && String(row.action).endsWith(".rates"))
    changes.push("No price differences");
  if (
    !changes.length &&
    row.before?.version !== row.after?.version &&
    row.after?.version != null
  )
    changes.push(
      `Version ${row.before?.version ?? "—"} → ${row.after.version}`,
    );
  return changes.join(" · ") || "Review recorded changes";
}
