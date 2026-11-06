import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconArchive,
  IconArrowUpRight,
  IconCopy,
  IconEqual,
  IconPencil,
  IconRefresh,
  IconUpload,
} from "@tabler/icons-react";
import type { RecordData } from "@/lib/api";
import { segment } from "@/lib/api";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  auditResourceName,
  auditSummary,
  countryChanges,
  pricingActionLabel,
  rateChanges,
} from "@/lib/pricing-audit";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataList, display, human } from "./shared";

function actionPresentation(row: RecordData) {
  const action = String(row.action || "");
  const scope = action.startsWith("international.")
    ? "International tariff"
    : action.startsWith("local.")
      ? "Local tariff"
      : action.startsWith("shipping.policy")
        ? "Shipping policy"
        : action.startsWith("catalogue.")
          ? "Shipping catalogue"
          : "Pricing";
  if (action.endsWith(".archive"))
    return { tone: "archived", Icon: IconArchive, label: "Archived", scope };
  if (action.endsWith(".clone"))
    return { tone: "cloned", Icon: IconCopy, label: "Draft cloned", scope };
  if (action.endsWith(".restore"))
    return {
      tone: "restored",
      Icon: IconRefresh,
      label: "Policies restored",
      scope,
    };
  if (action.endsWith(".publish") || action === "publish")
    return { tone: "published", Icon: IconUpload, label: "Published", scope };
  if (action.endsWith(".rates") && !rateChanges(row).length)
    return { tone: "unchanged", Icon: IconEqual, label: "Price update", scope };
  return {
    tone: "updated",
    Icon: IconPencil,
    label: action.endsWith(".rates")
      ? "Prices updated"
      : pricingActionLabel(action || "Unknown action"),
    scope,
  };
}
function AuditAction({ row }: { row: RecordData }) {
  const { Icon, label, scope } = actionPresentation(row);
  return (
    <div
      className="pricing-audit-action"
      title={pricingActionLabel(row.action || "Unknown action")}
    >
      <span className="pricing-audit-action-icon">
        <Icon size={19} stroke={1.8} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="pricing-audit-action-label">{label}</p>
        <p className="pricing-audit-action-scope">{scope}</p>
      </div>
    </div>
  );
}

const object = (value: unknown): RecordData =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
function valueLabel(value: unknown, key = ""): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return `${value.length.toLocaleString()} entries`;
  if (typeof value === "object")
    return (
      Object.entries(value)
        .map(
          ([name, item]) =>
            `${human(name)}: ${Array.isArray(item) ? `${item.length} entries` : typeof item === "object" && item !== null ? "Recorded details" : display(item, name)}`,
        )
        .join(" · ") || "No additional effects"
    );
  return display(value, key);
}
function countryLabel(country: RecordData | undefined) {
  if (!country) return "—";
  const parts: string[] = [];
  if (country.zone != null) parts.push(`Zone ${country.zone}`);
  if (country.active != null)
    parts.push(country.active ? "Available" : "Disabled");
  const postal = country.postalCodeRequired ?? country.postal_code_required;
  if (postal != null)
    parts.push(postal ? "Postal code required" : "Postal code optional");
  return parts.join(" · ") || "Mapped";
}
function AuditTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / DEFAULT_PAGE_SIZE));
  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="font-semibold">
        {title}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({rows.length.toLocaleString()})
        </span>
      </h3>
      <div className="overflow-auto rounded-lg border">
        <Table aria-label={title}>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header} className="whitespace-nowrap">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows
              .slice(page * DEFAULT_PAGE_SIZE, (page + 1) * DEFAULT_PAGE_SIZE)
              .map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, column) => (
                    <TableCell
                      key={column}
                      className="max-w-80 whitespace-normal break-words align-top"
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <nav
          aria-label={`${title} pagination`}
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span>
            Page {page + 1} of {pages} · 100 per page
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}
function AuditDetails({ row }: { row: RecordData }) {
  const before = object(row.before),
    after = object(row.after),
    effects = object(row.effects);
  const rates = useMemo(() => rateChanges(row), [row]);
  const countries = useMemo(() => countryChanges(row), [row]);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const fields = keys.filter(
    (key) =>
      !["updatedAt", "updated_at", "createdAt", "created_at"].includes(key) &&
      !Array.isArray(before[key]) &&
      !Array.isArray(after[key]) &&
      JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const collections = keys.filter(
    (key) => Array.isArray(before[key]) || Array.isArray(after[key]),
  );
  const currency = (amount: unknown) =>
    amount == null ? "—" : display(amount, "amountMinor");
  const resourcePath = String(row.action).startsWith("international.")
    ? `/export-rates/tariffs/${segment(row.resourceId)}`
    : String(row.action).startsWith("local.")
      ? `/delivery-zones/tariffs/${segment(row.resourceId)}`
      : undefined;
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(row, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `pricing-audit-${row.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="space-y-6 p-5 sm:p-6">
      <div className="space-y-2">
        <h3 className="font-semibold">Reason for change</h3>
        <p className="whitespace-pre-wrap break-words text-sm">
          {row.reason || "No reason recorded."}
        </p>
      </div>
      {resourcePath && (
        <Button variant="outline" size="sm" asChild>
          <Link to={resourcePath}>Open current tariff</Link>
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        This record shows the change at that time. The current tariff may have
        changed since.
      </p>
      {rates.length > 0 && (
        <AuditTable
          title="Price changes"
          headers={[
            "Zone",
            "Weight (kg)",
            "Change",
            "Before (NGN)",
            "After (NGN)",
          ]}
          rows={rates.map((rate) => [
            String(rate.zone ?? "Local"),
            (rate.weightGrams / 1000).toLocaleString("en-NG", {
              maximumFractionDigits: 3,
            }),
            rate.kind,
            currency(rate.before),
            currency(rate.after),
          ])}
        />
      )}
      {countries.length > 0 && (
        <AuditTable
          title="Country changes"
          headers={["Country", "Before", "After"]}
          rows={countries.map((country) => [
            `${country.name}${country.name !== country.code ? ` (${country.code})` : ""}`,
            countryLabel(country.before),
            countryLabel(country.after),
          ])}
        />
      )}
      {fields.length > 0 && (
        <AuditTable
          title="Record changes"
          headers={["Field", "Before", "After"]}
          rows={fields.map((key) => [
            human(key),
            valueLabel(before[key], key),
            valueLabel(after[key], key),
          ])}
        />
      )}
      {!rates.length &&
        !countries.length &&
        !fields.length &&
        !collections.length && (
          <p className="text-sm text-muted-foreground">
            No field or price differences were recorded.
          </p>
        )}
      {collections.length > 0 && (
        <AuditTable
          title="Snapshot contents"
          headers={["Collection", "Before", "After"]}
          rows={collections.map((key) => [
            human(key),
            Array.isArray(before[key])
              ? before[key].length.toLocaleString()
              : "—",
            Array.isArray(after[key])
              ? after[key].length.toLocaleString()
              : "—",
          ])}
        />
      )}
      <section className="space-y-3">
        <h3 className="font-semibold">Effects</h3>
        {Object.keys(effects).length ? (
          <dl className="space-y-3 text-sm">
            {Object.entries(effects).map(([key, value]) => (
              <div key={key}>
                <dt className="font-medium">
                  {key === "snapshot"
                    ? "Original catalogue snapshot"
                    : human(key)}
                </dt>
                <dd className="mt-1 break-all text-muted-foreground">
                  {valueLabel(value, key)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No additional effects recorded.
          </p>
        )}
      </section>
      <details className="border-t pt-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Record identifiers
        </summary>
        <dl className="mt-4 space-y-3 text-sm">
          {["id", "actorUid", "resourceId", "action", "createdAt"].map(
            (key) => (
              <div key={key}>
                <dt className="text-muted-foreground">{human(key)}</dt>
                <dd className="break-all">{String(row[key] ?? "—")}</dd>
              </div>
            ),
          )}
        </dl>
      </details>
      <Button variant="outline" onClick={download}>
        Download original audit record
      </Button>
    </div>
  );
}
export function PricingAuditHistory() {
  const [selected, setSelected] = useState<RecordData | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <DataList
        spec={{
          path: "/v1/admin/pricing/audit",
          title: "Price change history",
          paging: "cursor",
          key: "items",
          rowClassName: (row) =>
            `pricing-audit-row pricing-audit-tone--${actionPresentation(row).tone}`,
          note: "Open a change to compare recorded values. Unchanged price tiers are left out of the comparison.",
          columns: [
            {
              key: "resourceId",
              label: "Resource",
              render: (row) => (
                <div className="min-w-52 max-w-64 space-y-2">
                  <p className="font-semibold">{auditResourceName(row)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="pricing-audit-view"
                    onClick={(event) => {
                      trigger.current = event.currentTarget;
                      setSelected(row);
                    }}
                  >
                    View change
                    <IconArrowUpRight size={15} aria-hidden="true" />
                  </Button>
                </div>
              ),
            },
            { key: "createdAt", label: "When" },
            {
              key: "action",
              label: "Action",
              render: (row) => <AuditAction row={row} />,
            },
            {
              key: "changes",
              label: "What changed",
              render: (row) => (
                <p className="pricing-audit-summary min-w-44 max-w-60 text-sm">
                  {auditSummary(row)}
                </p>
              ),
            },
            { key: "reason", label: "Reason" },
            {
              key: "actorUid",
              label: "Changed by",
              render: (row) => (
                <span className="inline-block max-w-36 break-all text-sm">
                  {row.actorUid || "Not recorded"}
                </span>
              ),
            },
          ],
        }}
      />
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          className="w-full gap-0 overflow-hidden sm:max-w-4xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
        >
          <SheetHeader
            className={`pricing-audit-detail-header pricing-audit-tone--${selected ? actionPresentation(selected).tone : "updated"} border-b p-5 pr-12 sm:p-6`}
          >
            <SheetTitle>
              {selected
                ? pricingActionLabel(selected.action || "Unknown action")
                : "Pricing change"}
            </SheetTitle>
            <SheetDescription className="break-words">
              {selected && (
                <>
                  {auditResourceName(selected)} ·{" "}
                  {display(selected.createdAt, "createdAt")}
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto">
            {selected && <AuditDetails key={selected.id} row={selected} />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
