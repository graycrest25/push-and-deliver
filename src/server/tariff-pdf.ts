// Bound the complete multipart request before parsing, then enforce the file limit.
export const PDF_LIMIT = 2_097_152;
export class PdfUploadError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function readTariffPdf(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("multipart/form-data;"))
    throw new PdfUploadError(
      "Send the PDF and metadata as multipart/form-data.",
    );
  const limit = PDF_LIMIT + 65_536;
  if (Number(request.headers.get("content-length")) > limit)
    throw new PdfUploadError("The PDF must be no larger than 2 MiB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PdfUploadError("Select a PDF file.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new PdfUploadError("The PDF must be no larger than 2 MiB.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const form = await new Response(bytes, {
    headers: { "Content-Type": type },
  }).formData();
  const file = form.get("file"),
    metadata = form.get("metadata");
  if (
    form.getAll("file").length !== 1 ||
    form.getAll("metadata").length !== 1 ||
    [...form.keys()].some((key) => !["file", "metadata"].includes(key)) ||
    !file ||
    typeof file === "string" ||
    typeof metadata !== "string"
  )
    throw new PdfUploadError("Provide one PDF file and JSON metadata.");
  if (file.size > PDF_LIMIT)
    throw new PdfUploadError("The PDF must be no larger than 2 MiB.", 413);
  if (!file.size || !file.name.toLowerCase().endsWith(".pdf"))
    throw new PdfUploadError("Select a non-empty PDF file.");
  const data = JSON.parse(metadata);
  if (
    !data ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    typeof data.reason !== "string" ||
    !data.reason.trim() ||
    !Number.isSafeInteger(data.expectedVersion) ||
    data.expectedVersion < 0 ||
    typeof data.preview !== "boolean"
  )
    throw new PdfUploadError(
      "Provide a name, reason, snapshot version and preview flag.",
    );
  return form;
}
