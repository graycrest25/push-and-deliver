import type { RecordData } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { field, select, type Field } from "./shared";

export const riderVehicleFilter: Field = {
  ...select("vehicleType", ["bike", "unassigned"], "Vehicle type"),
  optionLabels: { bike: "Motorbike", unassigned: "Not assigned" },
};
export const riderFilters: Field[] = [
  riderVehicleFilter,
  select(
    "verificationStatus",
    ["verified", "blocked", "unverified"],
    "Verification status",
  ),
  field("email", "Exact email address", { type: "email", required: false }),
  field("startDate", "Start date", { type: "date", required: false }),
  field("endDate", "End date", { type: "date", required: false }),
];
export function onlineLabel(data: RecordData) {
  return (
    data.onlineStatusLabel ||
    (data.onlineStatus === true
      ? "Online"
      : data.onlineStatus === false
        ? "Offline"
        : "Unknown")
  );
}
export function RiderExportFilters({
  value,
  change,
}: {
  value: RecordData;
  change: (next: RecordData) => void;
}) {
  return (
    <>
      {[
        field("q", "Name, email or phone", { required: false }),
        ...riderFilters,
      ].map((f) => (
        <label key={f.name} className="space-y-2 text-sm">
          {f.label}
          {f.options ? (
            <select
              className="block h-10 rounded-md border bg-card px-3"
              value={value[f.name] || ""}
              onChange={(event) =>
                change({ ...value, [f.name]: event.target.value })
              }
            >
              <option value="">All</option>
              {f.options.map((option) => (
                <option key={option} value={option}>
                  {f.optionLabels?.[option] ||
                    option[0].toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={f.type === "email" || f.type === "date" ? f.type : "text"}
              value={value[f.name] || ""}
              onChange={(event) =>
                change({ ...value, [f.name]: event.target.value })
              }
            />
          )}
        </label>
      ))}
    </>
  );
}
