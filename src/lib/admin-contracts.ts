import type { RecordData } from "./api";
export function broadcastBody(values: RecordData) {
  if (!["rider", "customer", "all"].includes(values.audience))
    throw new Error("Choose riders, customers, or all accounts.");
  const title = String(values.title || "").trim();
  const body = String(values.body || "").trim();
  for (const [name, text, maximum] of [
    ["Title", title, 160],
    ["Message", body, 4000],
  ] as const) {
    if (!text || new TextEncoder().encode(text).length > maximum)
      throw new Error(
        `${name} must be nonblank and at most ${maximum.toLocaleString("en-NG")} UTF-8 bytes.`,
      );
  }
  return { audience: values.audience, title, body };
}
export function promoterBody(values: RecordData) {
  const name = String(values.name || "");
  if (!/^[A-Za-z0-9]{1,100}$/.test(name))
    throw new Error(
      "Use 1–100 ASCII letters or digits, with no spaces or punctuation.",
    );
  return { name };
}
