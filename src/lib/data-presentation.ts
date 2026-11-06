import { enumLabel } from "./enum-labels";
import type { RecordData } from "./api";

export type DataTone =
  | "info"
  | "positive"
  | "attention"
  | "danger"
  | "accent"
  | "teal"
  | "neutral";
const normalized = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();
export function statusTone(
  value: unknown,
  key = "status",
  scope = "",
): DataTone {
  const label = normalized(enumLabel(key, value, scope) ?? value);
  if (
    [
      "active",
      "enabled",
      "verified",
      "approved",
      "paid",
      "successful",
      "success",
      "succeeded",
      "completed",
      "deliveredtodestination",
      "clearancecompleted",
      "ready",
      "activated",
    ].includes(label)
  )
    return "positive";
  if (
    [
      "failed",
      "rejected",
      "cancelled",
      "blocked",
      "deleted",
      "expired",
      "needsinvestigation",
    ].includes(label)
  )
    return "danger";
  if (
    [
      "pending",
      "requested",
      "placed",
      "unpaid",
      "due",
      "incomplete",
      "unverified",
      "awaitingupload",
      "awaitingtransferverification",
      "retired",
    ].includes(label)
  )
    return "attention";
  if (["draft", "queued", "scheduled"].includes(label)) return "accent";
  if (
    [
      "accepted",
      "acceptedbyrider",
      "enroute",
      "enroutetodestination",
      "enroutetopndhq",
      "senttohq",
      "riderarrived",
      "running",
      "processing",
      "initializing",
      "submitting",
      "open",
      "assigned",
      "claimed",
    ].includes(label)
  )
    return "info";
  if (label === "closed") return "teal";
  return "neutral";
}
export function recordTone(row: RecordData, scope = ""): DataTone {
  if (row.deleted === true || row.disabled === true || row.blocked === true)
    return "danger";
  if (
    row.verificationStatus != null &&
    statusTone(row.verificationStatus, "verificationStatus", scope) === "danger"
  )
    return "danger";
  if (row.status != null) return statusTone(row.status, "status", scope);
  if (row.verificationStatus != null)
    return statusTone(row.verificationStatus, "verificationStatus", scope);
  if (typeof row.active === "boolean")
    return row.active ? "positive" : "neutral";
  if (typeof row.enabled === "boolean")
    return row.enabled ? "positive" : "neutral";
  return "neutral";
}
export function metricTone(key: string, value: unknown): DataTone {
  if (typeof value !== "number" || !Number.isFinite(value)) return "neutral";
  const name = normalized(key);
  if (name.includes("growth"))
    return value > 0 ? "positive" : value < 0 ? "danger" : "neutral";
  if (/blocked|failed|rejected|cancelled|deleted/.test(name)) return "danger";
  if (/pending|unpaid|unverified|unknown|due/.test(name)) return "attention";
  if (/verified|paid|completed|delivered|revenue|succeeded/.test(name))
    return "positive";
  if (/lastweek|previous/.test(name)) return "attention";
  if (/thisweek|week|average|avg/.test(name)) return "accent";
  if (/today|new|activation/.test(name)) return "teal";
  return "info";
}
