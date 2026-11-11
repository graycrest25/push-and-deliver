import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import {
  api,
  apiResponse,
  ApiError,
  segment,
  type RecordData,
} from "@/lib/api";
import {
  domesticTariffRoot,
  domesticZones,
  expectedDomesticTariffs,
  loadDomesticTariffs,
  pdfSha256,
  readDomesticPreview,
  type DomesticMetadata,
  type DomesticPreview,
} from "@/lib/domestic-tariff-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorNotice, Notice } from "./shared";

const maxBytes = 2_097_152;
const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});
type Operation = { file: File; metadata: DomesticMetadata; key?: string };

async function send(operation: Operation) {
  const body = new FormData();
  body.append("file", operation.file);
  body.append("metadata", JSON.stringify(operation.metadata));
  const response = await apiResponse(`${domesticTariffRoot}/import-pdf`, {
    method: "POST",
    body,
    headers: operation.key ? { "Idempotency-Key": operation.key } : undefined,
  });
  if (response.status !== 200)
    throw new Error("The response was not confirmed. Please retry.");
  return (await response.json()).data;
}

export function DomesticTariffPdfImport({ reload }: { reload: () => void }) {
  const { adminType } = useCurrentUser();
  return canOperate(adminType) ? <DomesticUpload reload={reload} /> : null;
}

function DomesticUpload({ reload }: { reload: () => void }) {
  const [tariffs, setTariffs] = useState<RecordData[]>([]);
  const [localType, setLocalType] = useState("premium");
  const [reason, setReason] = useState("Updated domestic shipping prices");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DomesticPreview | null>(null);
  const [reviewed, setReviewed] = useState<Operation | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [published, setPublished] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const [fileRevision, setFileRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadDomesticTariffs(controller.signal)
      .then(setTariffs)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      });
    return () => controller.abort();
  }, []);

  function invalidate() {
    setPreview(null);
    setReviewed(null);
    setConfirmed(false);
    setPublished(false);
    setError(null);
  }
  async function refreshTariffs() {
    const rows = await loadDomesticTariffs();
    setTariffs(rows);
    return rows;
  }
  async function run(publish: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    let publicationSent = !!pending;
    try {
      let operation: Operation;
      if (publish) {
        if (!preview || !reviewed || !confirmed)
          throw new Error("Review and confirm the preview before publishing.");
        if (pending) operation = pending;
        else {
          const current = expectedDomesticTariffs(
            await refreshTariffs(),
            reviewed.metadata.localType,
          );
          if (
            JSON.stringify(current) !==
            JSON.stringify(reviewed.metadata.expectedTariffs)
          ) {
            invalidate();
            reload();
            throw new Error(
              "The base tariffs changed. Preview all six zones again before publishing.",
            );
          }
          operation = {
            ...reviewed,
            metadata: { ...reviewed.metadata, preview: false },
            key: crypto.randomUUID(),
          };
          setPending(operation);
          publicationSent = true;
        }
      } else {
        invalidate();
        if (
          !file ||
          !file.size ||
          file.size > maxBytes ||
          !file.name.toLowerCase().endsWith(".pdf")
        )
          throw new Error(
            "Select a non-empty PDF no larger than 2 MiB (2,097,152 bytes).",
          );
        if (!reason.trim())
          throw new Error("Enter a reason for the price update.");
        operation = {
          file,
          metadata: {
            localType,
            reason: reason.trim(),
            preview: true,
            expectedTariffs: expectedDomesticTariffs(
              await refreshTariffs(),
              localType,
            ),
          },
        };
        if (
          new TextEncoder().encode(
            JSON.stringify({ ...operation.metadata, preview: false }),
          ).byteLength > 4096
        )
          throw new Error(
            "Metadata must be no larger than 4 KiB. Shorten the reason.",
          );
      }
      const result = await send(operation);
      if (!publish) {
        setPreview(
          readDomesticPreview(
            result,
            operation.metadata,
            await pdfSha256(operation.file),
          ),
        );
        setReviewed(operation);
      } else {
        if (
          result?.applied !== true ||
          typeof result.auditId !== "string" ||
          !result.auditId ||
          !Array.isArray(result.zones) ||
          result.zones.length !== 6 ||
          !domesticZones.every(
            (zone) =>
              result.zones.filter(
                (item: RecordData) =>
                  item?.zone === zone &&
                  typeof item.tariffId === "string" &&
                  item.tariffId &&
                  Number.isSafeInteger(item.version) &&
                  item.status === "active",
              ).length === 1,
          )
        )
          throw new Error(
            "Publication was not confirmed. Retry with the same operation key.",
          );
        setPublished(true);
        setPending(null);
        setPreview(null);
        setReviewed(null);
        setConfirmed(false);
        setFile(null);
        setFileRevision((value) => value + 1);
        reload();
        // Publication is confirmed; refresh failures must never turn into another write.
        const refreshed = await Promise.allSettled([
          refreshTariffs(),
          ...result.zones.map((zone: RecordData) =>
            api(`${domesticTariffRoot}/${segment(zone.tariffId)}/snapshot`),
          ),
        ]);
        if (refreshed.some((item) => item.status === "rejected"))
          setError(
            new Error(
              "Prices were published, but some tariff details could not be refreshed. Reload the page to see the latest prices.",
            ),
          );
      }
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        failure.status >= 400 &&
        failure.status < 500 &&
        ![408, 429].includes(failure.status)
      ) {
        setPending(null);
        invalidate();
        if (failure.status === 409) {
          reload();
          await refreshTariffs().catch(() => {});
          failure = new ApiError(
            409,
            failure.code,
            "The tariffs changed. Preview all six zones again before publishing.",
            failure.requestId,
          );
        } else if (failure.status === 403) {
          failure = new ApiError(
            403,
            failure.code,
            "Your admin account does not have permission to import domestic prices.",
            failure.requestId,
          );
        }
      } else if (publish && !publicationSent) {
        invalidate();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const services = [
    ...new Set([
      "premium",
      ...tariffs
        .filter((t) => t.status === "active")
        .map((t) => String(t.localType)),
    ]),
  ];
  return (
    <details className="rounded-lg border bg-card p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        Upload domestic rate PDF
      </summary>
      <div className="mt-5 space-y-5">
        <p className="text-sm text-muted-foreground">
          Select a PDF, preview prices, then confirm publication for all six
          zones. Use the one-page, text-based domestic six-zone template
          (maximum 2 MiB). Scanned images, international PDFs and other layouts
          are not supported.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(false);
          }}
          className="space-y-4"
        >
          <fieldset
            disabled={busy || !!pending}
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className="space-y-2 text-sm">
              Delivery service
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3"
                value={localType}
                onChange={(event) => {
                  invalidate();
                  setLocalType(event.target.value);
                }}
              >
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service === "premium" ? "Premium" : service}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Domestic rate PDF
              <Input
                key={fileRevision}
                type="file"
                accept=".pdf,application/pdf"
                required
                onChange={(event) => {
                  invalidate();
                  const selected = event.target.files?.[0] || null;
                  setFile(selected);
                  if (
                    selected &&
                    (!selected.size ||
                      selected.size > maxBytes ||
                      !selected.name.toLowerCase().endsWith(".pdf"))
                  )
                    setError(
                      new Error(
                        "Select a non-empty PDF no larger than 2 MiB (2,097,152 bytes).",
                      ),
                    );
                }}
              />
            </label>
            <label className="space-y-2 text-sm sm:col-span-2">
              Reason for price update
              <Input
                required
                value={reason}
                onChange={(event) => {
                  invalidate();
                  setReason(event.target.value);
                }}
              />
            </label>
          </fieldset>
          <Button
            variant="outline"
            type="submit"
            disabled={busy || !!pending || !file || file.size > maxBytes}
          >
            {busy && !pending ? "Preparing…" : "Preview prices"}
          </Button>
        </form>
        {error != null && <ErrorNotice error={error} />}
        {published && (
          <p role="status" className="font-medium">
            Prices published. All six zones are active.
          </p>
        )}
        {preview && (
          <section
            aria-label="Domestic PDF preview"
            className="space-y-4 border-t pt-4"
          >
            <Notice>
              {pending
                ? "Reviewed prices. Publication status is not yet confirmed."
                : "Preview only. No prices have changed."}
            </Notice>
            <p className="text-sm">
              {preview.importedRates} prices · up to{" "}
              {preview.maxImportedWeightKg} kg · {preview.localType}
            </p>
            <p className="text-sm text-muted-foreground">
              Scroll through the tables to review all weights and columns.
            </p>
            <div className="overflow-x-auto">
              <Table aria-label="Zone changes">
                <TableHeader>
                  <TableRow>
                    <TableHead>PDF zone</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Changed</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Removed bands (kg)</TableHead>
                    <TableHead>Higher-weight prices kept</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domesticZones.map((zone) => {
                    const summary = preview.zones.find(
                      (item) => item.zone === zone,
                    )!;
                    return (
                      <TableRow key={zone}>
                        <TableCell>Zone {summary.pdfZone}</TableCell>
                        <TableCell>{zone.toUpperCase()}</TableCell>
                        <TableCell>{summary.changedPrices}</TableCell>
                        <TableCell>{summary.addedPrices}</TableCell>
                        <TableCell>
                          {summary.removedWeightBandsKg.join(", ") || "None"}
                        </TableCell>
                        <TableCell>
                          {summary.preservedHigherWeightRates}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div
              className="max-h-96 overflow-auto rounded-lg border"
              tabIndex={0}
              aria-label="All domestic price changes"
            >
              <Table aria-label="Old and new domestic prices">
                <TableHeader>
                  <TableRow>
                    <TableHead>Weight (kg)</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Old price (NGN)</TableHead>
                    <TableHead>New price (NGN)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rates.map((rate) => (
                    <TableRow key={`${rate.zone}:${rate.weightGrams}`}>
                      <TableCell>{rate.weightKg}</TableCell>
                      <TableCell>{rate.zone.toUpperCase()}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {rate.previousAmountMinor === null
                          ? "New weight band"
                          : naira.format(rate.previousAmountMinor / 100)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {naira.format(rate.amountMinor / 100)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={confirmed}
                disabled={busy || !!pending}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I have reviewed these prices and confirm publication for all six
              zones.
            </label>
            {pending && !busy && (
              <Notice>
                The publication response was not confirmed. Retry sends the
                identical PDF and metadata with the same operation key.
              </Notice>
            )}
            <Button
              disabled={busy || !confirmed}
              onClick={() => void run(true)}
            >
              {busy
                ? "Publishing…"
                : pending
                  ? "Retry publication"
                  : "Publish prices"}
            </Button>
          </section>
        )}
      </div>
    </details>
  );
}
