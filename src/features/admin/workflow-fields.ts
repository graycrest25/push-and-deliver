import { field, nairaField, type Field } from "./shared";
import type { RecordData } from "@/lib/api";
export const reasonField = field("reason", "Reason for change", {
  type: "textarea",
  maxLength: 500,
});
export function version(data: RecordData) {
  if (!Number.isSafeInteger(data.version) || data.version < 1)
    throw new Error("Load the current record before saving.");
  return data.version;
}
export function reason(value: unknown) {
  const text = String(value || "").trim();
  if (!text || Array.from(text).length > 500)
    throw new Error("Enter a reason of 1–500 characters.");
  return text;
}
export const moneyField = (
  name: string,
  label: string,
  required = true,
  maximum = 100000000000,
): Field => ({ ...nairaField(name, label, 0, maximum), required, default: "" });

export function integer(value: unknown, min = 0, max = 100000000000) {
  const n = Number(value);
  if (value === "" || !Number.isSafeInteger(n) || n < min || n > max)
    throw new Error(`Enter a whole number between ${min} and ${max}.`);
  return n;
}
export const changed = (
  values: RecordData,
  source: RecordData,
  keys: string[],
) =>
  Object.fromEntries(
    keys
      .filter(
        (key) =>
          values[key] !== undefined &&
          values[key] !== source[key] &&
          !(values[key] === "" && source[key] == null),
      )
      .map((key) => [key, values[key] === "" ? null : values[key]]),
  );
export function requireChanges(changes: RecordData) {
  if (!Object.keys(changes).length)
    throw new Error("Change at least one field before saving.");
  return changes;
}
