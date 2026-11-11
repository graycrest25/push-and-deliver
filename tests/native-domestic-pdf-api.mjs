// Contract fixtures for domestic PDF transport; no PDF parsing is simulated here.
const root = "/v1/admin/geography/tariffs";
const zones = ["abv", "iba", "kad", "los", "phc", "qrw"];
let enabled = false,
  version = 7,
  failure = 0,
  malformed = false;
let applied = new Map();
export function controlDomesticPdf(body) {
  if (body.reset) {
    enabled = false;
    version = 7;
    failure = 0;
    malformed = false;
    applied = new Map();
  }
  if (body.domesticPdf !== undefined) enabled = body.domesticPdf;
  if (body.domesticVersion !== undefined) version = body.domesticVersion;
  if (body.domesticFailure !== undefined) failure = body.domesticFailure;
  if (body.domesticMalformed !== undefined) malformed = body.domesticMalformed;
}
export function domesticPdf(path, req, res, body, success, error) {
  if (!enabled || !path.startsWith(root)) return false;
  const reply = (data) => {
    success(res, data);
    return true;
  };
  const fail = (status, message) => {
    error(res, status, "pdf_error", message);
    return true;
  };
  if (path === root && req.method === "GET") {
    const second = new URL(req.url, "http://localhost").searchParams.has(
      "cursor",
    );
    const rows = zones.map((zone, index) => ({
      id: `domestic-${zone}-${version}`,
      localType: "premium",
      zone,
      version: version + index,
      status: "active",
    }));
    // Draft and different-service records must never be used as preview bases.
    return reply({
      items: second
        ? rows.slice(3)
        : [
            { ...rows[0], id: "draft", status: "draft" },
            { ...rows[0], id: "other-service", localType: "economy" },
            ...rows.slice(0, 3),
          ],
      nextCursor: second ? null : "remaining-zones",
    });
  }
  if (path.endsWith("/snapshot"))
    return reply({ id: path.split("/").at(-2), status: "active", version });
  if (path !== `${root}/import-pdf`) return false;
  if (failure && (failure !== 503 || !body.metadata.preview)) {
    const status = failure;
    failure = 0;
    if (status !== 503)
      return fail(
        status,
        status === 400
          ? "Unsupported domestic PDF layout."
          : "Import denied or stale.",
      );
    // Apply before losing the response to exercise ambiguous outcomes and safe replay.
    const result = {
      applied: true,
      auditId: "domestic-audit",
      zones: zones.map((zone) => ({
        zone,
        tariffId: `replacement-${zone}`,
        version: ++version,
        status: "active",
      })),
    };
    applied.set(req.headers["idempotency-key"], result);
    return fail(503, "Publication response interrupted.");
  }
  if (!body.metadata.preview) {
    const key = req.headers["idempotency-key"];
    if (!key) return fail(400, "Missing idempotency key.");
    if (applied.has(key)) return reply(applied.get(key));
    if (body.metadata.expectedTariffs[0].expectedVersion !== version)
      return fail(409, "Tariffs changed.");
    const result = {
      applied: true,
      auditId: "domestic-audit",
      zones: zones.map((zone) => ({
        zone,
        tariffId: `replacement-${zone}`,
        version: ++version,
        status: "active",
      })),
    };
    applied.set(key, result);
    return reply(result);
  }
  const weights = Array.from({ length: 48 }, (_, i) =>
    i === 47 ? 70 : (i + 1) / 2,
  );
  return reply({
    applied: false,
    localType: body.metadata.localType,
    sourceSha256: body.fileHash,
    currency: "NGN",
    weightUnit: "kg",
    importedRates: 288,
    maxImportedWeightKg: 70,
    zoneMapping: zones.map((zone, i) => ({ zone, pdfZone: i + 1 })),
    zones: body.metadata.expectedTariffs.map((base, i) => ({
      zone: base.zone,
      pdfZone: i + 1,
      baseTariffId: base.tariffId,
      baseVersion: base.expectedVersion,
      importedRates: 48,
      changedPrices: 47,
      addedPrices: 1,
      removedWeightBandsKg: [26],
      preservedHigherWeightRates: 2,
    })),
    rates: weights
      .flatMap((weightKg, i) =>
        zones.map((zone) => ({
          zone,
          weightKg,
          weightGrams: weightKg * 1000,
          amountMinor: 2013536,
          previousAmountMinor: i === 47 ? null : 1000000,
        })),
      )
      .slice(malformed ? 1 : 0),
  });
}
