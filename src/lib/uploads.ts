import { api, ApiError, segment } from "./api";
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const FILE_TYPES = [...IMAGE_TYPES, "application/pdf"];
export const UPLOAD_PURPOSES = [
  "avatar",
  "support_attachment",
  "shipment_item",
  "customs_document",
  "packing_list",
  "invoice",
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export function uploadLimit(purpose: UploadPurpose) {
  return ["avatar", "support_attachment", "shipment_item"].includes(purpose)
    ? 5 * 1024 * 1024
    : MAX_UPLOAD_BYTES;
}
export function uploadImagesOnly(purpose: UploadPurpose) {
  return uploadLimit(purpose) < MAX_UPLOAD_BYTES;
}
export interface UploadAsset {
  id: string;
  status: "ready";
  mime_type: string;
  size_bytes: number;
}
export interface UploadDraft {
  version: 2;
  key: string;
  name: string;
  size: number;
  mime: string;
  sha256: string;
  purpose: UploadPurpose;
  assetId?: string;
  transferred?: boolean;
  operationId?: string;
}
export interface UploadProgress {
  message: string;
  percent: number;
}
interface Intent {
  assetId: string;
  status: string;
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
}
interface Completion {
  assetId: string;
  status: string;
  contentType?: string;
  sizeBytes?: number;
  jobId?: string;
}
const root = (id: string) => `/v1/assets/${segment(id)}`;
export async function digest(blob: Blob) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
  );
}
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export async function prepareUpload(
  file: File,
  imagesOnly: boolean,
  purpose?: UploadPurpose,
): Promise<UploadDraft> {
  if (!purpose || !UPLOAD_PURPOSES.includes(purpose))
    throw new Error(
      "This destination does not have a supported native upload purpose yet.",
    );
  if (
    !(
      imagesOnly || uploadImagesOnly(purpose) ? IMAGE_TYPES : FILE_TYPES
    ).includes(file.type)
  )
    throw new Error(
      "Choose a supported JPEG, PNG, WebP or PDF file for this purpose.",
    );
  if (!file.size || file.size > uploadLimit(purpose))
    throw new Error(
      `Choose a non-empty file no larger than ${uploadLimit(purpose) / 1024 / 1024} MiB.`,
    );
  return {
    version: 2,
    key: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    mime: file.type,
    sha256: base64(await digest(file)),
    purpose,
  };
}
function validateDraft(draft: UploadDraft) {
  if (draft.version !== 2 || !UPLOAD_PURPOSES.includes(draft.purpose))
    throw new Error(
      "This saved upload uses the retired upload service. Start a new native upload.",
    );
}
function pause(ms: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
async function request<T>(
  path: string,
  signal: AbortSignal,
  options: RequestInit = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api<T>(path, {
        ...options,
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      });
    } catch (error) {
      signal.throwIfAborted();
      const transient =
        error instanceof ApiError
          ? [429, 502, 503, 504].includes(error.status)
          : error instanceof TypeError ||
            (error instanceof DOMException && error.name === "TimeoutError");
      const retryAfter =
        error instanceof ApiError ? error.retryAfter : undefined;
      const delay = retryAfter
        ? /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Date.parse(retryAfter) - Date.now()
        : 750 * 2 ** attempt;
      if (!transient || attempt >= 3 || delay > 30000) throw error;
      await pause(Math.max(0, Number.isFinite(delay) ? delay : 1000), signal);
    }
  }
}
function create(draft: UploadDraft, signal: AbortSignal) {
  return request<Intent>("/v1/assets/upload-intents", signal, {
    method: "POST",
    headers: { "Idempotency-Key": draft.key },
    body: JSON.stringify({
      purpose: draft.purpose,
      contentType: draft.mime,
      sizeBytes: draft.size,
      checksumSha256: draft.sha256,
    }),
  });
}
export async function runUpload(
  draft: UploadDraft,
  file: File | undefined,
  signal: AbortSignal,
  saved: (draft: UploadDraft) => void,
  progress: (value: UploadProgress) => void,
): Promise<UploadAsset> {
  validateDraft(draft);
  if (!draft.transferred) {
    if (!file)
      throw new Error("Select the original file to resume this upload.");
    if (
      file.size !== draft.size ||
      file.type !== draft.mime ||
      base64(await digest(file)) !== draft.sha256
    )
      throw new Error(
        "This file differs from the original. Select the original file or discard this upload.",
      );
    const signed = await create(draft, signal);
    if (!signed.assetId || (draft.assetId && draft.assetId !== signed.assetId))
      throw new Error(
        "The service returned a different upload. Discard and start again.",
      );
    draft = { ...draft, assetId: signed.assetId };
    saved(draft);
    const url = new URL(signed.uploadUrl);
    const local =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      signed.method !== "PUT" ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      !(Date.parse(signed.expiresAt) > Date.now()) ||
      signed.maxSizeBytes < file.size
    )
      throw new Error(
        "The storage service returned an invalid upload destination.",
      );
    const headers = new Headers();
    for (const [key, value] of Object.entries(signed.headers || {})) {
      if (["host", "content-length"].includes(key.toLowerCase())) continue;
      if (["authorization", "cookie"].includes(key.toLowerCase()))
        throw new Error("Unsupported storage credentials.");
      headers.set(key, value);
    }
    progress({ message: "Uploading file…", percent: 10 });
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: file,
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
    });
    if (!response.ok)
      throw new Error(
        "File transfer failed. Resume with the original file to retry.",
      );
    draft = { ...draft, transferred: true };
    saved(draft);
  }
  const deadline = Date.now() + 120000;
  let delay = 750;
  for (;;) {
    signal.throwIfAborted();
    progress({ message: "Validating file…", percent: 95 });
    if (draft.operationId) {
      const operation = await request<{
        status: string;
        error?: { message?: string };
      }>(`/v1/operations/${segment(draft.operationId)}`, signal);
      if (operation.status === "failed")
        throw new Error(
          "The file did not pass processing. Discard it and choose a valid file.",
        );
      if (operation.status !== "succeeded") {
        if (Date.now() > deadline)
          throw new Error(
            "Processing is still running. Resume to check again.",
          );
        await pause(delay, signal);
        delay = Math.min(8000, delay * 1.5);
        continue;
      }
    }
    const completion = await request<Completion>(
      `${root(draft.assetId!)}/complete`,
      signal,
      {
        method: "POST",
        headers: { "Idempotency-Key": `${draft.key}:complete` },
      },
    );
    if (completion.assetId !== draft.assetId)
      throw new Error("The completed file does not match this upload.");
    if (completion.status === "ready") {
      if (!completion.contentType || !completion.sizeBytes)
        throw new Error("Completed file metadata is missing.");
      progress({ message: "File ready", percent: 100 });
      return {
        id: completion.assetId,
        status: "ready",
        mime_type: completion.contentType,
        size_bytes: completion.sizeBytes,
      };
    }
    if (!completion.jobId || completion.status !== "pending")
      throw new Error("The service returned an unknown file-processing state.");
    draft = { ...draft, operationId: completion.jobId };
    saved(draft);
    if (Date.now() > deadline)
      throw new Error("Processing is still running. Resume to check again.");
    await pause(delay, signal);
    delay = Math.min(8000, delay * 1.5);
  }
}
export async function discardUpload(
  draft: UploadDraft,
  signal: AbortSignal,
  saved: (draft: UploadDraft) => void,
) {
  validateDraft(draft);
  // Recover creation using the original key if the response was lost.
  const assetId = draft.assetId || (await create(draft, signal)).assetId;
  if (!assetId)
    throw new Error("The upload could not be identified for deletion.");
  saved({ ...draft, assetId });
  await request(root(assetId), signal, {
    method: "DELETE",
    headers: { "Idempotency-Key": `${draft.key}:delete` },
  });
}
