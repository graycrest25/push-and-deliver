/** Normalize account creation dates without discarding non-Timestamp values. */
export function accountDate(value: unknown): Date | undefined {
  try {
    const candidate =
      value && typeof value === "object" && "toDate" in value &&
      typeof value.toDate === "function"
        ? value.toDate()
        : value;
    const date = candidate instanceof Date ? candidate :
      typeof candidate === "string" || typeof candidate === "number"
        ? new Date(candidate)
        : undefined;
    return date && Number.isFinite(date.getTime()) ? date : undefined;
  } catch {
    return undefined;
  }
}

export function formatAccountCreatedAt(value: unknown): string {
  return accountDate(value)?.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }) ?? "N/A";
}
