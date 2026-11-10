import {
  TariffPdfPreview,
  readPdfPreview,
  type PdfPreview,
} from "./tariff-pdf-preview";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import {
  api,
  apiResponse,
  ApiError,
  segment,
  type RecordData,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNotice, Notice, RecordView } from "./shared";

type Metadata = {
  name: string;
  reason: string;
  expectedVersion: number;
  preview: boolean;
};
type Operation = {
  file: File;
  metadata: Metadata;
  key: string;
  storageKey?: string;
};
const maxBytes = 2_097_152;

async function send(root: string, operation: Operation) {
  const body = new FormData();
  body.append("file", operation.file);
  body.append("metadata", JSON.stringify(operation.metadata));
  const response = await apiResponse(`${root}/import-pdf`, {
    method: "POST",
    body,
    headers: { "Idempotency-Key": operation.key },
  });
  if (![200, 201].includes(response.status))
    throw new Error(
      "The operation was not confirmed. Retry with the same file and operation key.",
    );
  const envelope = await response.json();
  const result = envelope.data ?? envelope;
  if (!result || typeof result !== "object" || !Object.keys(result).length)
    throw new Error(
      "The server returned no review details. Retry the request.",
    );
  return result as RecordData;
}

export function TariffPdfImport({
  data,
  root,
  reload,
}: {
  data: RecordData;
  root: string;
  reload: () => void;
}) {
  const { adminType, user } = useCurrentUser();
  const [open, setOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const [reviewed, setReviewed] = useState<Operation | null>(null);
  const [pending, setPending] = useState<Operation | null>(null);
  const [published, setPublished] = useState<RecordData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const previewAttempt = useRef<Operation | null>(null);
  const publishedTariffId =
    typeof published?.id === "string" &&
    published.id.trim() &&
    published.id !== data.id &&
    ![".", ".."].includes(published.id)
      ? published.id
      : null;
  if (
    !canOperate(adminType) ||
    data.carrier !== "dhl" ||
    data.direction !== "export" ||
    data.cargo !== "non_document"
  )
    return null;

  if (!pending && !published && data.status !== "active")
    return (
      <Notice>
        PDF upload is available on the active DHL export non-document tariff.
        Open the active tariff from Shipping tariffs to import a price list.
      </Notice>
    );

  function invalidate() {
    setPreview(null);
    setReviewed(null);
    setError(null);
    previewAttempt.current = null;
  }
  async function run(publish: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (
        !file ||
        !file.size ||
        file.size > maxBytes ||
        !file.name.toLowerCase().endsWith(".pdf")
      )
        throw new Error(
          "Select a non-empty PDF no larger than 2 MiB (2,097,152 bytes).",
        );
      if (!name.trim() || !reason.trim())
        throw new Error("Enter a name and reason.");
      let operation: Operation;
      if (publish) {
        if (!reviewed || !preview)
          throw new Error("Preview this file before publishing.");
        if (pending) operation = pending;
        else {
          const current = await api(`${root}/snapshot`);
          if (
            current.version !== reviewed.metadata.expectedVersion ||
            current.status !== "active"
          ) {
            invalidate();
            throw new Error(
              "The tariff changed. Preview the PDF again before publishing.",
            );
          }
          const metadata = { ...reviewed.metadata, preview: false };
          const digest = await crypto.subtle.digest(
            "SHA-256",
            await reviewed.file.arrayBuffer(),
          );
          const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
          const operationDigest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              JSON.stringify({
                root,
                fingerprint,
                fileName: reviewed.file.name,
                fileType: reviewed.file.type,
                metadata,
              }),
            ),
          );
          const operationHash = Array.from(
            new Uint8Array(operationDigest),
            (byte) => byte.toString(16).padStart(2, "0"),
          ).join("");
          const storageKey = `pnd-tariff-pdf:${user?.id}:${operationHash}`;
          const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
          sessionStorage.setItem(storageKey, key);
          operation = { file: reviewed.file, metadata, key, storageKey };
          setPending(operation);
        }
      } else {
        setPreview(null);
        setReviewed(null);
        if (previewAttempt.current) operation = previewAttempt.current;
        else {
          const current = await api(`${root}/snapshot`);
          if (
            !Number.isSafeInteger(current.version) ||
            current.version < 0 ||
            current.status !== "active"
          )
            throw new Error(
              "Refresh and select the active DHL tariff before previewing.",
            );
          operation = {
            file,
            metadata: {
              name: name.trim(),
              reason: reason.trim(),
              expectedVersion: current.version,
              preview: true,
            },
            key: crypto.randomUUID(),
          };
          previewAttempt.current = operation;
        }
      }
      const result = await send(root, operation);
      if (publish) {
        if (result.applied === false)
          throw new Error(
            "Publication has not been applied. Retry with the same operation key.",
          );
        setPublished(result);
        setPending(null);
        try {
          if (operation.storageKey)
            sessionStorage.removeItem(operation.storageKey);
        } catch {
          /* Publication already succeeded; storage cleanup is best effort. */
        }
      } else {
        try {
          setPreview(
            readPdfPreview(result, data.id, operation.metadata.expectedVersion),
          );
        } catch (failure) {
          previewAttempt.current = null;
          throw failure;
        }
        setReviewed(operation);
        previewAttempt.current = null;
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
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group/pdf min-w-0"
    >
      <summary className="-mx-2 flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-md px-2 py-3 text-sm font-semibold outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>Upload price-list PDF</span>
        <IconChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/pdf:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-5 pb-5 pt-2">
        <p className="max-w-prose text-sm text-muted-foreground">
          Choose a PDF, preview the changes, then publish the reviewed prices.
          Publishing activates the replacement tariff. Higher-weight prices and
          unlisted country mappings stay unchanged.
        </p>
        <details className="group/template text-sm">
          <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-md px-2 py-2 text-primary outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span>PDF template requirements</span>
            <IconChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/template:rotate-90 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              Maximum 2 MiB. One page of selectable text, headed “PND EXPORT
              RATE”.
            </li>
            <li>
              Keep the existing layout: KG and ZONE 1–8, with eight naira prices
              to two decimal places per row.
            </li>
            <li>
              Include 0.5–5 kg in 0.5 kg steps, then 6–25 kg in 1 kg steps, with
              the country-to-zone table underneath.
            </li>
            <li>
              Scanned, encrypted, incomplete and unrecognised PDFs are rejected
              without changing live prices.
            </li>
          </ul>
        </details>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(false);
          }}
          className="space-y-4"
        >
          <fieldset
            disabled={busy || !!pending || !!published}
            className="grid gap-4 sm:grid-cols-2"
          >
            <label className="space-y-2 text-sm sm:col-span-2">
              Price-list PDF
              <Input
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
            <label className="space-y-2 text-sm">
              Price-list name
              <Input
                required
                value={name}
                onChange={(event) => {
                  invalidate();
                  setName(event.target.value);
                }}
              />
            </label>
            <label className="space-y-2 text-sm">
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
          {!published && (
            <Button
              type="submit"
              variant="outline"
              disabled={busy || !!pending || !file || file.size > maxBytes}
            >
              {busy && !pending ? "Previewing…" : "Preview"}
            </Button>
          )}
        </form>
        {error != null && <ErrorNotice error={error} />}
        {preview && !published && (
          <section aria-label="PDF preview" className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">
              Review price and country-zone changes
            </h3>
            <TariffPdfPreview preview={preview} />
            {pending && !busy && (
              <Notice>
                The publication response was not confirmed. Retry sends the same
                PDF, metadata and operation key.
              </Notice>
            )}
            <Button disabled={busy} onClick={() => void run(true)}>
              {busy
                ? "Publishing…"
                : pending
                  ? "Retry publication"
                  : "Publish prices"}
            </Button>
          </section>
        )}
        {published && (
          <div role="status" className="space-y-4">
            <p className="font-semibold">
              Prices published. The replacement tariff is active.
            </p>
            <RecordView data={published} />
            {publishedTariffId ? (
              <Button asChild>
                <Link
                  to={`/export-rates/tariffs/${segment(publishedTariffId)}`}
                >
                  Open published tariff
                </Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={reload}>
                Refresh tariff details
              </Button>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
