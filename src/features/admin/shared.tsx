import { enumLabel, readableEnum } from "@/lib/enum-labels";
import { tableColumnClass } from "@/lib/table-layout";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { metricTone, recordTone } from "@/lib/data-presentation";
import { DataStatus } from "@/components/ui/data-status";
import {
  RecordSkeleton,
  TableSkeleton,
} from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import type { UploadPurpose } from "@/lib/uploads";
import { useTableStateStore } from "./table-state";
import { canAccessAdminScreen } from "@/lib/admin-access";
import { useCurrentUser } from "@/contexts/UserContext";
import { AssetField, UploadFormContext } from "@/features/uploads/asset-field";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IconArrowRight, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  api,
  apiResponse,
  ApiError,
  queryPath,
  type RecordData,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const human = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/, (c) => c.toUpperCase())
    .replace(/\bUid\b/g, "UID")
    .replace(/\bId\b/g, "ID");
export function display(
  value: unknown,
  key = "",
  currency = "NGN",
  scope = "",
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value
      .map((item) => enumLabel(key, item, scope) ?? String(item))
      .join(", ");
  const label = enumLabel(key, value, scope);
  if (label !== undefined) return label;
  if (typeof value === "number" && /(_minor|Minor)$/.test(key))
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
    }).format(value / 100);
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return (
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(new Date(value)) + " WAT"
    );
  if (
    typeof value === "number" &&
    ["activation_rate", "activationRate"].includes(key)
  )
    return new Intl.NumberFormat("en-NG", {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(value);
  if (typeof value === "number" && key.endsWith("_percent"))
    return `${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}%`;
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}
function RecordImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <span className="text-muted-foreground">Image unavailable</span>;
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open full-size image"
      className="inline-block max-w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <img
        src={src}
        alt="Profile photo"
        loading="lazy"
        className="h-32 w-32 rounded-lg border bg-muted object-contain"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

// Keep dates and their Lagos-local time together in narrow table columns.
function TableValue({
  value,
  name,
  currency,
  scope,
}: {
  value: unknown;
  name: string;
  currency: string;
  scope?: string;
}) {
  if (name.toLowerCase() === "imageurl" && typeof value === "string" && value)
    return <RecordImage key={value} src={value} />;
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  ) {
    const date = new Date(value);
    return (
      <time
        dateTime={value}
        title={display(value, name, currency)}
        className="inline-flex min-w-[7.5rem] flex-col gap-0.5 whitespace-nowrap tabular-nums"
      >
        <span>
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeZone: "Africa/Lagos",
          }).format(date)}
        </span>{" "}
        <span className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat("en-GB", {
            timeStyle: "short",
            timeZone: "Africa/Lagos",
          }).format(date)}{" "}
          WAT
        </span>
      </time>
    );
  }
  return <>{display(value, name, currency, scope)}</>;
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
export function ErrorNotice({
  error,
  retry,
  showReadinessLink = true,
}: {
  error: unknown;
  retry?: () => void;
  showReadinessLink?: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2"
    >
      <p className="text-destructive">
        {error instanceof Error ? error.message : String(error)}
      </p>
      {showReadinessLink &&
        error instanceof ApiError &&
        error.code === "analytics_not_ready" && (
          <Link className="text-primary underline" to="/analytics-coverage">
            Inspect report readiness
          </Link>
        )}
      {error instanceof ApiError && error.status === 409 && (
        <p>
          Check the current record and the action’s requirements before starting
          a new attempt.
        </p>
      )}
      {error instanceof ApiError && error.requestId && (
        <p className="text-muted-foreground break-all">
          Request reference: {error.requestId}
        </p>
      )}
      {error instanceof ApiError && error.retryAfter && (
        <p>Retry after: {error.retryAfter}</p>
      )}
      {retry && <RefreshButton onClick={retry}>Try again</RefreshButton>}
    </div>
  );
}
export function useResource(path: string | null) {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!!path);
  const [revision, setRevision] = useState(0);
  const [resourcePath, setResourcePath] = useState(path);
  useEffect(() => {
    const abort = new AbortController();
    setResourcePath(path);
    setData(null);
    setError(null);
    setLoading(!!path);
    if (path)
      api(path, { signal: abort.signal })
        .then((result) => {
          if (!abort.signal.aborted) setData(result);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    return () => abort.abort();
  }, [path, revision]);
  return {
    data: resourcePath === path ? data : null,
    error: resourcePath === path ? error : null,
    loading: resourcePath === path ? loading : !!path,
    reload: () => setRevision((n) => n + 1),
  };
}
export function InformationCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card role="region" aria-label={title}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">
          <h2>{title}</h2>
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function RecordSections({
  title,
  data,
  action,
  labels = {},
  analytics = false,
}: {
  title: string;
  data: RecordData;
  action?: ReactNode;
  labels?: Record<string, string>;
  analytics?: boolean;
}) {
  const entries = Object.entries(data);
  const fields = entries.filter(
    ([, value]) => value === null || typeof value !== "object",
  );
  const groups = entries.filter(
    ([, value]) => value !== null && typeof value === "object",
  );
  return (
    <div className="space-y-6">
      <InformationCard title={title} action={action}>
        <RecordView data={Object.fromEntries(fields)} analytics={analytics} />
      </InformationCard>
      {groups.map(([key, value]) => (
        <InformationCard key={key} title={labels[key] || human(key)}>
          <RecordView data={value} scope={key} analytics={analytics} />
        </InformationCard>
      ))}
    </div>
  );
}
export function RecordView({
  data,
  scope = "",
  analytics = false,
}: {
  data: unknown;
  scope?: string;
  analytics?: boolean;
}) {
  const { adminType } = useCurrentUser();
  if (Array.isArray(data))
    return data.length ? (
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={item?.id ?? i} className="border-b pb-3 last:border-0">
            <RecordView data={item} scope={scope} analytics={analytics} />
          </div>
        ))}
      </div>
    ) : (
      <span className="text-muted-foreground">No entries</span>
    );
  if (!data || typeof data !== "object")
    return <span>{display(data, scope, "NGN", scope)}</span>;
  const entries = Object.entries(data).filter(
    ([key]) =>
      !(key === "onlineStatus" && Object.hasOwn(data, "onlineStatusLabel")) &&
      ![
        "quote_id",
        "quoteId",
        "pickupOtp",
        "pickup_otp",
        "latitude_e7",
        "longitude_e7",
        "access_token",
        "refresh_token",
      ].includes(key),
  );
  return (
    <dl
      className={`grid min-w-0 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3 ${analytics ? "analytics-values" : ""}`}
    >
      {entries.map(([key, value]) => (
        <div
          key={key}
          className={`min-w-0 ${value && typeof value === "object" ? "col-span-full" : ""} ${analytics && typeof value === "number" ? "analytics-metric" : ""}`}
          data-tone={
            analytics && typeof value === "number"
              ? metricTone(key, value)
              : undefined
          }
        >
          <dt className="text-xs font-semibold text-muted-foreground">
            {key.toLowerCase() === "imageurl"
              ? "Photo"
              : key === "onlineStatusLabel"
                ? "Online status"
                : human(key.replace(/(_minor|Minor)$/, ""))}
          </dt>
          <dd className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
            {key.toLowerCase() === "imageurl" && !value ? (
              <span className="flex h-32 w-32 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                No photo
              </span>
            ) : key.toLowerCase() === "imageurl" &&
              typeof value === "string" &&
              value ? (
              <RecordImage key={value} src={value} />
            ) : value && typeof value === "object" ? (
              <RecordView data={value} scope={key} analytics={analytics} />
            ) : recordDestination(
                key,
                data as RecordData,
                { path: "", paging: "none", columns: [] },
                adminType,
              ) ? (
              <Link
                className="text-primary underline"
                to={
                  recordDestination(
                    key,
                    data as RecordData,
                    { path: "", paging: "none", columns: [] },
                    adminType,
                  )!
                }
              >
                {display(value, key)}
              </Link>
            ) : (
              display(value, key, (data as RecordData).currency || "NGN", scope)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export type Field = {
  name: string;
  label: string;
  type?:
    | "asset"
    | "assets"
    | "text"
    | "number"
    | "email"
    | "password"
    | "date"
    | "datetime-local"
    | "textarea"
    | "boolean"
    | "select"
    | "list"
    | "rows"
    | "group";
  // Rider selection uses the native paginated directory, not an eligibility guess.
  riderSelection?: boolean;
  imagesOnly?: boolean;
  vendorOwned?: boolean;
  ownAsset?: boolean;
  purpose?: UploadPurpose;
  riderUid?: string;
  options?: string[];
  optionLabels?: Record<string, string>;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  pattern?: string;
  help?: string;
  fields?: Field[];
  default?: any;
};
export const field = (
  name: string,
  label = human(name),
  props: Partial<Field> = {},
): Field => ({ name, label, required: true, ...props });
export const select = (
  name: string,
  options: string[],
  label = human(name),
): Field => field(name, label, { type: "select", options });
export const number = (
  name: string,
  label = human(name),
  min = 0,
  max = 100000000000,
): Field => field(name, label, { type: "number", min, max, default: 0 });
export const bool = (name: string, label = human(name)): Field =>
  field(name, label, { type: "boolean", default: false });
export function defaults(
  fields: Field[],
  initial: RecordData = {},
): RecordData {
  return Object.fromEntries(
    fields.map((f) => [
      f.name,
      initial[f.name] ??
        f.default ??
        (f.type === "group"
          ? defaults(f.fields || [])
          : f.type === "rows" || f.type === "assets"
            ? []
            : f.type === "boolean"
              ? false
              : f.type === "select"
                ? f.options?.[0] || ""
                : ""),
    ]),
  );
}
function RiderSelection({
  id,
  label,
  value,
  change,
}: {
  id: string;
  label: string;
  value: string;
  change: (value: string) => void;
}) {
  const [cursors, setCursors] = useState([""]),
    [page, setPage] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState("");
  const resource = useResource(
    queryPath("/v1/admin/users", {
      type: "riders",
      limit: DEFAULT_PAGE_SIZE,
      cursor: cursors[page],
    }),
  );
  const rows = resource.data?.items || [];
  return (
    <div className="col-span-full space-y-3">
      <Label htmlFor={id}>{label} *</Label>
      <select
        id={id}
        required
        className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
        disabled={resource.loading || !!resource.error}
        value={value}
        onChange={(event) => {
          change(event.target.value);
          setSelectedLabel(
            rows.find((row: RecordData) => row.uid === event.target.value)
              ?.username || event.target.value,
          );
        }}
      >
        <option value="">Select a rider</option>
        {value && !rows.some((row: RecordData) => row.uid === value) && (
          <option value={value}>
            {selectedLabel} · {value}
          </option>
        )}
        {rows.map((row: RecordData) => (
          <option key={row.uid} value={row.uid}>
            {row.username || "Name unavailable"} · {row.uid}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        The backend checks the selected rider's availability and capacity when
        assigning.
      </p>
      {resource.error != null && (
        <ErrorNotice error={resource.error} retry={resource.reload} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resource.loading || page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous riders
        </Button>
        <span className="text-xs text-muted-foreground">Page {page + 1}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resource.loading || !resource.data?.nextCursor}
          onClick={() => {
            setCursors([
              ...cursors.slice(0, page + 1),
              resource.data!.nextCursor,
            ]);
            setPage(page + 1);
          }}
        >
          Next riders
        </Button>
      </div>
    </div>
  );
}
function Fields({
  fields,
  value,
  change,
  prefix,
  path = "",
}: {
  fields: Field[];
  value: RecordData;
  change: (value: RecordData) => void;
  prefix: string;
  path?: string;
}) {
  const uploads = useContext(UploadFormContext);
  return (
    <>
      {fields.map((f) => {
        const id = `${prefix}-${f.name}`;
        const update = (v: unknown) => change({ ...value, [f.name]: v });
        if (f.riderSelection)
          return (
            <RiderSelection
              key={id}
              id={id}
              label={f.label}
              value={value[f.name] || ""}
              change={update}
            />
          );
        if (f.type === "asset" || f.type === "assets")
          return (
            <AssetField
              key={`${uploads.scope}:${id}`}
              id={id}
              path={`${path}.${f.name}`}
              label={f.label}
              required={f.required}
              imagesOnly={f.imagesOnly}
              vendorOwned={f.vendorOwned}
              ownAsset={f.ownAsset}
              purpose={f.purpose}
              riderUid={f.riderUid}
              multiple={f.type === "assets"}
              value={value[f.name] || (f.type === "assets" ? [] : "")}
              change={update}
            />
          );
        if (f.type === "group")
          return (
            <fieldset
              key={id}
              className="col-span-full space-y-3 border-t pt-4"
            >
              <legend className="px-1 text-sm font-semibold">{f.label}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Fields
                  fields={f.fields || []}
                  value={value[f.name] || {}}
                  change={update}
                  prefix={id}
                  path={`${path}.${f.name}`}
                />
              </div>
            </fieldset>
          );
        if (f.type === "rows")
          return (
            <fieldset
              key={id}
              className="col-span-full space-y-3 border-t pt-4"
            >
              <legend className="text-sm font-semibold">{f.label}</legend>
              {(value[f.name] || []).map((row: RecordData, i: number) => (
                <div className="space-y-3 rounded-lg border p-4" key={i}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Fields
                      fields={f.fields || []}
                      value={row}
                      change={(next) =>
                        update(
                          value[f.name].map((r: RecordData, n: number) =>
                            n === i ? next : r,
                          ),
                        )
                      }
                      prefix={`${id}-${i}`}
                      path={`${path}.${f.name}.${i}`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploads.hasDrafts}
                    title={
                      uploads.hasDrafts
                        ? "Save or discard uploaded files before removing rows."
                        : undefined
                    }
                    onClick={() =>
                      update(
                        value[f.name].filter(
                          (_: unknown, n: number) => n !== i,
                        ),
                      )
                    }
                  >
                    <IconTrash size={16} />
                    Remove {f.label.toLowerCase().replace(/s$/, "")} {i + 1}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  update([...(value[f.name] || []), defaults(f.fields || [])])
                }
              >
                <IconPlus size={16} />
                Add {f.label.toLowerCase().replace(/s$/, "")}
              </Button>
            </fieldset>
          );
        return (
          <div
            key={id}
            className={`space-y-2 ${f.type === "textarea" ? "col-span-full" : ""}`}
          >
            <Label htmlFor={id}>
              {f.label}
              {f.required && f.type !== "boolean" ? " *" : ""}
            </Label>
            {f.type === "boolean" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={!!value[f.name]}
                  onChange={(e) => update(e.target.checked)}
                />
                Enabled
              </label>
            ) : f.type === "select" ? (
              <select
                id={id}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={value[f.name] ?? ""}
                onChange={(e) => update(e.target.value)}
              >
                {f.options?.map((option) => (
                  <option key={option} value={option}>
                    {f.optionLabels?.[option] ||
                      enumLabel(f.name, option) ||
                      human(option)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <Textarea
                id={id}
                value={value[f.name] ?? ""}
                required={f.required}
                maxLength={f.maxLength}
                onChange={(e) => update(e.target.value)}
              />
            ) : (
              <Input
                id={id}
                type={
                  ["list", "text", undefined].includes(f.type) ? "text" : f.type
                }
                value={
                  Array.isArray(value[f.name])
                    ? value[f.name].join(", ")
                    : (value[f.name] ?? "")
                }
                required={f.required}
                min={f.min}
                max={f.max}
                step={f.step ?? (f.type === "number" ? 1 : undefined)}
                maxLength={f.maxLength}
                pattern={f.pattern}
                aria-describedby={f.help ? `${id}-help` : undefined}
                onChange={(e) =>
                  update(
                    f.type === "number" && e.target.value !== ""
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}{" "}
            {f.help && (
              <p id={`${id}-help`} className="text-xs text-muted-foreground">
                {f.help}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
function serialize(fields: Field[], value: RecordData): RecordData {
  return Object.fromEntries(
    fields.map((f) => {
      let v = value[f.name];
      if (
        (f.type === "asset" || f.type === "assets") &&
        f.required &&
        (!v || (Array.isArray(v) && !v.length))
      )
        throw new Error(`Add a ready file for ${f.label.toLowerCase()}.`);
      if (f.type === "assets") v = Array.isArray(v) ? v : [];
      if (f.type === "list")
        v = Array.isArray(v)
          ? v
          : String(v || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
      if (f.type === "datetime-local" && v) v = new Date(v).toISOString();
      if (f.type === "group") v = serialize(f.fields || [], v || {});
      if (f.type === "rows")
        v = (v || []).map((r: RecordData) => serialize(f.fields || [], r));
      if (f.type === "number" && v === "" && !f.required)
        return [f.name, undefined];
      if (f.type === "number" && (v === "" || !Number.isFinite(v)))
        throw new Error(`${f.label} must be a number.`);
      return [f.name, v];
    }),
  );
}
export interface Action {
  title: string;
  description?: string;
  path: string | ((data: RecordData) => string);
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  fields?: Field[];
  initial?: RecordData;
  body?: (data: RecordData) => unknown;
  bodyWithCurrent?: (values: RecordData, current: RecordData) => unknown;
  success?: string;
  preserveRetry?: boolean;
  operationScope?: string;
  versionPath?: string;
  versionRead?: () => Promise<RecordData>;
  refreshBeforeSubmit?: boolean;
  validateCurrent?: (current: RecordData) => void;
  renderCurrent?: (current: RecordData) => ReactNode;
  conflictHelp?: string;
  minimumVersion?: 0 | 1;
  expectedStatus?: number;
  renderResult?: (result: RecordData) => ReactNode;
  restartLabel?: string;
  validateResult?: (result: RecordData) => void;
}
export function ActionForm({
  action,
  onSuccess,
}: {
  action: Action;
  onSuccess?: (result: RecordData) => void;
}) {
  const formId = useId();
  const { user } = useCurrentUser();
  const location = useLocation();
  const uploads = useRef(
    new Map<string, { pending: boolean; drafts: boolean }>(),
  );
  const [uploadState, setUploadState] = useState({
    pending: false,
    drafts: false,
  });
  const [committed, setCommitted] = useState(0);
  const trackUploads = useCallback(
    (id: string, pending: boolean, drafts: boolean) => {
      if (pending || drafts) uploads.current.set(id, { pending, drafts });
      else uploads.current.delete(id);
      const all = [...uploads.current.values()];
      const next = {
        pending: all.some((v) => v.pending),
        drafts: all.some((v) => v.drafts),
      };
      setUploadState((old) =>
        old.pending === next.pending && old.drafts === next.drafts ? old : next,
      );
    },
    [],
  );
  const [value, setValue] = useState(() =>
    defaults(action.fields || [], action.initial),
  );
  const [retryAt, setRetryAt] = useState(0);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(
      () => setRetryAt(0),
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const lock = useRef(false);
  const operationStorage = useRef<string>();
  const [conflict, setConflict] = useState(false);
  const [conflictReference, setConflictReference] = useState<string>();
  const [latest, setLatest] = useState<RecordData | null>(null);
  const [reviewedVersion, setReviewedVersion] = useState<number>();
  const pending = useRef<{ path: string; body: string; key: string }>();
  // Persist only a random key and body fingerprint; no personal/financial form values.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      lock.current ||
      retryAt > Date.now() ||
      result != null ||
      [...uploads.current.values()].some((v) => v.pending)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const values = pending.current
        ? {}
        : serialize(action.fields || [], value);
      const path =
        pending.current?.path ??
        (typeof action.path === "function" ? action.path(values) : action.path);
      let payload = pending.current
        ? undefined
        : action.body
          ? action.body(values)
          : values;
      let currentVersion = reviewedVersion;
      if (action.refreshBeforeSubmit && !pending.current) {
        const current = action.versionRead
          ? await action.versionRead()
          : await api(action.versionPath!);
        setLatest(current);
        if (
          !Number.isSafeInteger(current.version) ||
          current.version < (action.minimumVersion ?? 1)
        )
          throw new Error("A current version is required.");
        action.validateCurrent?.(current);
        currentVersion = current.version;
        if (action.bodyWithCurrent)
          payload = action.bodyWithCurrent(values, current);
      }
      const body =
        pending.current?.body ??
        JSON.stringify(
          currentVersion !== undefined && payload && typeof payload === "object"
            ? { ...payload, expectedVersion: currentVersion }
            : payload,
        );
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          `${user?.id || "anonymous"}:${action.method || "POST"}:${path}:${body}${action.operationScope === undefined ? "" : `:scope:${action.operationScope}`}`,
        ),
      );
      const storageKey =
        "pnd-operation:" +
        Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      operationStorage.current = storageKey;
      let key: string;
      try {
        key =
          pending.current?.key ||
          sessionStorage.getItem(storageKey) ||
          crypto.randomUUID();
        sessionStorage.setItem(storageKey, key);
      } catch {
        throw new Error(
          "Enable session storage to safely retry this operation.",
        );
      }
      if (action.preserveRetry) pending.current = { path, body, key };
      const options: RequestInit = {
        method: action.method || "POST",
        body,
        headers: { "Idempotency-Key": key },
      };
      let response: RecordData;
      let responseRequestId: string | undefined;
      if (action.expectedStatus) {
        const result = await apiResponse(path, options);
        responseRequestId = result.headers.get("x-request-id") || undefined;
        const envelope = await result.json().catch(() => {
          throw new ApiError(
            502,
            "invalid_response",
            "The service returned an unreadable response. Retry with the same details.",
            responseRequestId,
          );
        });
        responseRequestId ||= envelope?.requestId;
        if (result.status !== action.expectedStatus)
          throw new ApiError(
            502,
            "unexpected_response",
            "The service did not confirm acceptance. Retry with the same details.",
            responseRequestId,
          );
        response = envelope?.data ?? envelope;
      } else response = await api(path, options);
      try {
        action.validateResult?.(response);
      } catch (failure) {
        throw new ApiError(
          502,
          "invalid_response",
          failure instanceof Error
            ? failure.message
            : "The service response could not be confirmed.",
          responseRequestId,
        );
      }
      sessionStorage.removeItem(storageKey);
      pending.current = undefined;
      // Clear before a successful resource reload can unmount this form.
      const uploadPrefix = `pnd-upload:${user?.id}:${location.pathname}:${action.title}:`;
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(uploadPrefix)) sessionStorage.removeItem(key);
      setResult(response);
      setCommitted((n) => n + 1);
      onSuccess?.(response);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        ![408, 429].includes(e.status)
      ) {
        pending.current = undefined;
        if (operationStorage.current)
          sessionStorage.removeItem(operationStorage.current);
        if (e.status === 409) {
          setConflict(true);
          setConflictReference(e.requestId);
          if (action.versionPath || action.versionRead) {
            try {
              setLatest(
                action.versionRead
                  ? await action.versionRead()
                  : await api(action.versionPath!),
              );
            } catch {
              setLatest(null);
            }
          }
        }
      }
      if (e instanceof ApiError && e.retryAfter) {
        const until = /^\d+$/.test(e.retryAfter)
          ? Date.now() + Number(e.retryAfter) * 1000
          : Date.parse(e.retryAfter);
        if (Number.isFinite(until) && until > Date.now()) setRetryAt(until);
      }
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        {action.title}
      </summary>
      <UploadFormContext.Provider
        value={{
          scope: `${location.pathname}:${action.title}`,
          vendorId: String(value.vendor_id || ""),
          committed,
          hasDrafts: uploadState.drafts,
          track: trackUploads,
        }}
      >
        <form className="mt-4 space-y-4" onSubmit={submit}>
          {action.description && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {action.description}
            </p>
          )}
          <fieldset
            disabled={busy || result != null || !!pending.current}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Fields
              fields={action.fields || []}
              value={value}
              change={setValue}
              prefix={formId}
            />
          </fieldset>
          {error != null && <ErrorNotice error={error} />}{" "}
          {error instanceof ApiError && error.details?.fields && (
            <RecordView data={error.details.fields} />
          )}
          {conflict && (action.versionPath || action.versionRead) && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm">
                {action.conflictHelp ||
                  "Your draft is preserved. Review the current record before resubmitting."}
              </p>
              {latest &&
                (action.renderCurrent ? (
                  action.renderCurrent(latest)
                ) : (
                  <RecordView data={latest} />
                ))}
              {conflictReference &&
                !(
                  error instanceof ApiError &&
                  error.requestId === conflictReference
                ) && (
                  <p className="break-all text-sm text-muted-foreground">
                    Request reference: {conflictReference}
                  </p>
                )}
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    const current =
                      latest ||
                      (action.versionRead
                        ? await action.versionRead()
                        : await api(action.versionPath!));
                    if (
                      !current ||
                      !Number.isSafeInteger(current.version) ||
                      current.version < (action.minimumVersion ?? 1)
                    )
                      throw new Error("A current version is required.");
                    action.validateCurrent?.(current);
                    setLatest(current);
                    setReviewedVersion(current.version);
                    setConflict(false);
                    setError(null);
                  } catch (failure) {
                    setError(failure);
                  }
                }}
              >
                {latest
                  ? "Use refreshed version and review draft"
                  : "Load current record"}
              </Button>
            </div>
          )}
          {error != null && pending.current && (
            <p className="text-sm text-muted-foreground">
              Retry sends the same details and operation key. Check the record
              before starting a different action.
            </p>
          )}
          {result != null && (
            <div role="status" className="space-y-3">
              <p className="text-sm font-medium">
                {action.success || "Saved successfully."}
              </p>
              {action.renderResult ? (
                action.renderResult(result as RecordData)
              ) : (
                <RecordView data={result} />
              )}
            </div>
          )}
          {uploadState.pending && (
            <p role="status" className="text-sm text-muted-foreground">
              Finish or discard pending uploads before saving.
            </p>
          )}
          <Button
            disabled={
              busy ||
              !!retryAt ||
              conflict ||
              uploadState.pending ||
              result != null
            }
            type="submit"
          >
            {busy ? "Submitting…" : action.title}
          </Button>
          {result != null && (
            <Button
              type="button"
              variant="outline"
              className="ml-2"
              onClick={() => setResult(null)}
            >
              {action.restartLabel || "Start another action"}
            </Button>
          )}
        </form>
      </UploadFormContext.Provider>
    </details>
  );
}
export type Paging = "after-id" | "after-cursor" | "cursor" | "offset" | "none";
export function verificationLabel(value: unknown) {
  const labels: Record<string, string> = {
    "0": "Unverified",
    "1": "Verified",
    "2": "Blocked",
    "3": "Deleted",
    unverified: "Unverified",
    verified: "Verified",
    blocked: "Blocked",
    deleted: "Deleted",
  };
  return labels[String(value)] || "Unknown";
}
export function recordDestination(
  key: string,
  row: RecordData,
  spec: ListSpec,
  role: unknown,
): string | undefined {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) return;
  const name = key.replace(/_/g, "").toLowerCase();
  let destination: string | undefined;
  if (name === "uid" && spec.path === "/v1/admin/users")
    destination = `/${spec.params?.type === "riders" ? "riders" : "users"}/${encodeURIComponent(value)}`;
  else if (["id", "uid"].includes(name) && spec.link)
    destination = spec.link(row);
  else if (["riderid", "rideruid", "assignedriderid"].includes(name))
    destination = `/riders/${encodeURIComponent(value)}`;
  else if (
    [
      "userid",
      "useruid",
      "customerid",
      "customeruid",
      "targetuid",
      "owneruid",
    ].includes(name)
  )
    destination = `/users/${encodeURIComponent(value)}`;
  else if (name === "referreduid") {
    const type = row.referreduserType;
    if (type === "rider" || type === "user")
      destination = `/${type === "rider" ? "riders" : "users"}/${encodeURIComponent(value)}`;
  } else if (name === "referreruid") {
    const type = row.referrerAccountType;
    if (type === "rider" || type === "user")
      destination = `/${type === "rider" ? "riders" : "users"}/${encodeURIComponent(value)}`;
  } else if (["shipmentid"].includes(name))
    destination = `/shipment-orders/${encodeURIComponent(value)}`;
  else if (["rideid"].includes(name))
    destination = `/ride-hailing/${encodeURIComponent(value)}`;
  else if (name === "orderid") {
    const kind = row.orderType ?? row.order_type ?? row.service;
    const section = (
      {
        shipment: "shipment-orders",
        food: "restaurant-orders",
        restaurant: "restaurant-orders",
        ecommerce: "product-orders",
        ride: "ride-hailing",
        ridehailing: "ride-hailing",
        courier: "ride-hailing",
      } as Record<string, string>
    )[kind];
    if (section) destination = `/${section}/${encodeURIComponent(value)}`;
  }
  return destination && canAccessAdminScreen(role, destination.split("?")[0])
    ? destination
    : undefined;
}
export type Column = {
  key: string;
  label?: string;
  render?: (row: RecordData) => ReactNode;
};
export interface ListSpec {
  path: string;
  key?: string;
  paging: Paging;
  columns: Column[];
  idKey?: string;
  link?: (row: RecordData) => string;
  clickableRows?: boolean;
  title?: string;
  filters?: Field[];
  pairedDates?: boolean;
  updateFilterDraft?: (draft: RecordData, name: string) => RecordData;
  onFiltersChange?: (filters: RecordData) => void;
  initialFilters?: RecordData;
  params?: RecordData;
  note?: string;
  pageSizes?: number[];
  defaultPageSize?: number;
  rowClassName?: (row: RecordData) => string;
  search?: {
    param: string;
    label: string;
    placeholder?: string;
    help?: string;
    maxLength?: number;
  };
  overview?: (data: RecordData) => ReactNode;
  overviewLoading?: ReactNode;
}
export function DataList(props: { spec: ListSpec; revision?: number }) {
  const location = useLocation();
  return (
    <DataListContent
      key={`${location.pathname}:${props.spec.path}:${JSON.stringify(props.spec.params || {})}:${JSON.stringify(props.spec.initialFilters || {})}`}
      {...props}
    />
  );
}
function DataListContent({
  spec,
  revision = 0,
}: {
  spec: ListSpec;
  revision?: number;
}) {
  const store = useTableStateStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { adminType } = useCurrentUser();
  const storageKey = `${pathname}:${spec.path}:${JSON.stringify(spec.params || {})}:${JSON.stringify(spec.initialFilters || {})}`;
  const saved = store?.get(storageKey);
  const [filters, setFilters] = useState<RecordData>(
    saved?.filters ?? spec.initialFilters ?? {},
  );
  const [filterError, setFilterError] = useState<string | null>(null);
  useEffect(() => {
    spec.onFiltersChange?.(filters);
  }, [filters, spec.onFiltersChange]);
  const [draft, setDraft] = useState<RecordData>(
    saved?.draft ?? spec.initialFilters ?? {},
  );
  const pageSizes = spec.pageSizes ?? [10, 25, 50, 100];
  const [size, setSize] = useState(
    saved && pageSizes.includes(saved.size)
      ? saved.size
      : (spec.defaultPageSize ?? DEFAULT_PAGE_SIZE),
  );
  // Cursors belong to this mounted query, never to saved table preferences.
  const [cursors, setCursors] = useState<string[]>([""]);
  const [page, setPage] = useState(0);
  const searchTerm = spec.search
    ? String(draft[spec.search.param] || "").trim()
    : "";
  const committedSearch = spec.search
    ? String(filters[spec.search.param] || "")
    : "";
  const searchParam = spec.search?.param;
  const searching = !!searchParam && searchTerm !== committedSearch;
  const searchId = useId();
  useEffect(() => {
    if (!searchParam || searchTerm === committedSearch) return;
    const timer = setTimeout(() => {
      setFilters((current) => ({
        ...current,
        [searchParam]: searchTerm || undefined,
      }));
      setPage(0);
      setCursors([""]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchParam, searchTerm, committedSearch]);
  const viewport = useRef<HTMLDivElement>(null);
  const scroll = useRef({
    scrollTop: 0,
    scrollLeft: saved?.scrollLeft ?? 0,
  });
  useEffect(() => {
    store?.set(storageKey, {
      filters,
      draft,
      size,
      scrollLeft: scroll.current.scrollLeft,
    });
  }, [store, storageKey, filters, draft, size]);
  const current = cursors[page] || "";
  const path = queryPath(spec.path, {
    ...spec.params,
    ...filters,
    ...(spec.paging === "none" ? {} : { limit: size }),
    ...(current
      ? {
          [spec.paging === "cursor"
            ? "cursor"
            : spec.paging === "offset"
              ? "offset"
              : "after"]: current,
        }
      : {}),
  });
  const resource = useResource(path);
  const data = searching ? null : resource.data;
  const error = searching ? null : resource.error;
  const loading = searching || resource.loading;
  const reload = resource.reload;
  useEffect(() => {
    if (!loading && viewport.current) {
      viewport.current.scrollTop = scroll.current.scrollTop;
      viewport.current.scrollLeft = scroll.current.scrollLeft;
    }
  }, [loading]);
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current !== revision) {
      lastRevision.current = revision;
      reload();
    }
  }, [revision]);
  const rows: RecordData[] = data
    ? spec.key
      ? data[spec.key] || []
      : Array.isArray(data)
        ? data
        : []
    : [];
  let next = "";
  if (data && data.hasMore !== false && spec.paging !== "none") {
    if (spec.paging === "after-cursor" || spec.paging === "cursor")
      next = String(data.next_cursor ?? data.nextCursor ?? "");
    else if (rows.length === size)
      next =
        spec.paging === "offset"
          ? String(Number(current || 0) + rows.length)
          : String(rows.at(-1)?.[spec.idKey || "id"] ?? "");
  }
  return (
    <div className="space-y-6">
      {loading ? spec.overviewLoading : !error && data && spec.overview?.(data)}
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {spec.title || "Records"}
            </CardTitle>
            <RefreshButton size="sm" loading={loading} onClick={reload}>
              Refresh
            </RefreshButton>
          </div>
          {spec.search && (
            <div className="max-w-xl space-y-2">
              <Label htmlFor={searchId}>{spec.search.label}</Label>
              <Input
                id={searchId}
                type="search"
                autoComplete="off"
                maxLength={spec.search.maxLength}
                placeholder={spec.search.placeholder}
                value={draft[spec.search.param] || ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    [spec.search!.param]: event.target.value,
                  })
                }
                aria-describedby={`${searchId}-help`}
              />
              <p
                id={`${searchId}-help`}
                className="text-xs text-muted-foreground"
              >
                {spec.search.help || "Results update as you type."}
              </p>
              <span className="sr-only" role="status">
                {searching
                  ? "Waiting for search"
                  : loading
                    ? "Loading results"
                    : "Results updated"}
              </span>
            </div>
          )}
          {spec.filters?.length ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  spec.pairedDates &&
                  (!!draft.startDate !== !!draft.endDate ||
                    (draft.startDate && draft.startDate > draft.endDate))
                ) {
                  setFilterError(
                    "Select both dates, with the end date on or after the start date, or clear both.",
                  );
                  return;
                }
                setFilterError(null);
                setFilters({
                  ...draft,
                  ...(searchParam
                    ? { [searchParam]: searchTerm || undefined }
                    : {}),
                });
                setPage(0);
                setCursors([""]);
              }}
              className="flex flex-wrap items-end gap-3"
            >
              {spec.filters.map((f) => (
                <div key={f.name} className="min-w-40 flex-1 space-y-2">
                  <Label htmlFor={`filter-${f.name}`}>{f.label}</Label>
                  {f.options ? (
                    <select
                      id={`filter-${f.name}`}
                      className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                      value={draft[f.name] || ""}
                      onChange={(e) => {
                        const next = { ...draft, [f.name]: e.target.value };
                        setDraft(
                          spec.updateFilterDraft?.(next, f.name) ?? next,
                        );
                      }}
                    >
                      <option value="">All</option>
                      {f.options.filter(Boolean).map((o) => (
                        <option key={o} value={o}>
                          {f.optionLabels?.[o] ||
                            enumLabel(f.name, o, spec.path) ||
                            human(o)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`filter-${f.name}`}
                      type={f.type || "text"}
                      maxLength={f.maxLength}
                      value={draft[f.name] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [f.name]: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
              <Button type="submit" disabled={loading}>
                Apply filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilterError(null);
                  setDraft({});
                  setFilters({});
                  setPage(0);
                  setCursors([""]);
                }}
              >
                Clear
              </Button>
            </form>
          ) : null}
          {filterError && (
            <p role="alert" className="text-sm text-destructive">
              {filterError}
            </p>
          )}
          {spec.note && (
            <p className="text-sm text-muted-foreground">{spec.note}</p>
          )}
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorNotice error={error} retry={reload} />
          ) : loading ? (
            <TableSkeleton
              columns={spec.columns.map(
                (column) =>
                  column.label ||
                  human(column.key.replace(/(_minor|Minor)$/, "")),
              )}
              rows={size}
              columnKeys={spec.columns.map((column) => column.key)}
              hasAction={!!spec.link}
            />
          ) : (
            <div
              ref={viewport}
              onScroll={(e) => {
                scroll.current = {
                  scrollTop: e.currentTarget.scrollTop,
                  scrollLeft: e.currentTarget.scrollLeft,
                };
                const state = store?.get(storageKey);
                if (state) state.scrollLeft = scroll.current.scrollLeft;
              }}
              className="max-h-[65vh] overflow-auto rounded-lg border"
            >
              <Table className="min-w-[800px]">
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    {spec.columns.map((c) => (
                      <TableHead
                        key={c.key}
                        className={tableColumnClass(c.key)}
                      >
                        {c.label || human(c.key.replace(/(_minor|Minor)$/, ""))}
                      </TableHead>
                    ))}
                    {spec.link && (
                      <TableHead>
                        <span className="sr-only">Open record</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={row[spec.idKey || "id"] ?? i}
                      className={[
                        spec.rowClassName?.(row),
                        spec.clickableRows && spec.link
                          ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={
                        spec.clickableRows && spec.link
                          ? (event) => {
                              if (
                                event.defaultPrevented ||
                                (event.target as HTMLElement).closest(
                                  "a, button, input, select, textarea, [role='button'], [role='link'], [contenteditable='true']",
                                ) ||
                                window.getSelection()?.toString()
                              )
                                return;
                              navigate(spec.link!(row));
                            }
                          : undefined
                      }
                      tone={
                        spec.rowClassName
                          ? undefined
                          : recordTone(row, spec.path)
                      }
                    >
                      {spec.columns.map((c) => (
                        <TableCell
                          key={c.key}
                          data-column={c.key}
                          className={`${tableColumnClass(c.key)} whitespace-normal break-words align-top`}
                        >
                          {c.render ? (
                            c.render(row)
                          ) : recordDestination(c.key, row, spec, adminType) ? (
                            <Link
                              className="inline-block max-w-full break-all leading-5 text-primary underline underline-offset-4"
                              to={
                                recordDestination(c.key, row, spec, adminType)!
                              }
                            >
                              {String(row[c.key])}
                            </Link>
                          ) : c.key === "verificationStatus" ? (
                            <DataStatus
                              value={row[c.key]}
                              field="verificationStatus"
                              label={verificationLabel(row[c.key])}
                              scope={spec.path}
                            />
                          ) : c.key === "status" ? (
                            <DataStatus value={row[c.key]} scope={spec.path} />
                          ) : ["active", "enabled"].includes(c.key) &&
                            typeof row[c.key] === "boolean" ? (
                            <DataStatus
                              value={row[c.key]}
                              label={row[c.key] ? "Yes" : "No"}
                              tone={row[c.key] ? "positive" : "neutral"}
                            />
                          ) : (
                            <TableValue
                              value={row[c.key]}
                              name={c.key}
                              currency={row.currency || "NGN"}
                              scope={spec.path}
                            />
                          )}
                        </TableCell>
                      ))}
                      {spec.link && (
                        <TableCell>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="record-view-button"
                          >
                            <Link
                              to={spec.link(row)}
                              aria-label={`Open ${row.display_name || row.username || row.name || row.id || row.uid || "record"}`}
                            >
                              View
                              <IconArrowRight size={16} />
                            </Link>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow>
                      <TableCell
                        colSpan={spec.columns.length + 1}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No records found
                        {Object.keys(filters).length
                          ? " for these filters."
                          : "."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {spec.paging !== "none" && (
            <nav
              aria-label="Record pagination"
              className="mt-5 flex flex-wrap items-center justify-between gap-3"
            >
              <label className="flex items-center gap-2 text-sm">
                Rows per page
                <select
                  aria-label="Rows per page"
                  disabled={loading}
                  className="h-9 rounded-md border bg-card px-2"
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(0);
                    setCursors([""]);
                  }}
                >
                  {pageSizes.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <span role="status" className="text-sm text-muted-foreground">
                Page {page + 1} ·{" "}
                {loading
                  ? "Loading records…"
                  : `${rows.length} records on this page`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page === 0}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    loading ||
                    !!error ||
                    !next ||
                    next === current ||
                    (spec.paging === "offset" && Number(next) > 10000)
                  }
                  onClick={() => {
                    setCursors([...cursors.slice(0, page + 1), next]);
                    setPage((n) => n + 1);
                  }}
                >
                  Next
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export function ResourcePanel({
  title,
  path,
  grouped = false,
  sectionLabels,
}: {
  title: string;
  path: string;
  grouped?: boolean;
  sectionLabels?: Record<string, string>;
}) {
  const { data, error, loading, reload } = useResource(path);
  const analytics =
    /\/analytics\/|\/dashboard(?:\?|$)|\/referrals\/summary/.test(path);
  if (grouped && loading)
    return (
      <div className="space-y-6">
        <InformationCard
          title={title}
          action={
            <RefreshButton loading onClick={reload}>
              Refresh
            </RefreshButton>
          }
        >
          <RecordSkeleton />
        </InformationCard>
        {Object.entries(sectionLabels || {}).map(([key, label]) => (
          <InformationCard key={key} title={label}>
            <RecordSkeleton />
          </InformationCard>
        ))}
      </div>
    );
  if (
    grouped &&
    !loading &&
    !error &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  )
    return (
      <RecordSections
        title={title}
        data={data}
        labels={sectionLabels}
        analytics={analytics}
        action={
          <RefreshButton loading={loading} onClick={reload}>
            Refresh
          </RefreshButton>
        }
      />
    );
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <RefreshButton size="sm" onClick={reload} loading={loading}>
          Refresh
        </RefreshButton>
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorNotice error={error} retry={reload} />
        ) : loading ? (
          <RecordSkeleton />
        ) : (
          <RecordView data={data} analytics={analytics} />
        )}
      </CardContent>
    </Card>
  );
}
export function ExportForm({
  type,
}: {
  type: "accounts" | "withdrawals" | "riders";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  async function download(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const filters = Object.fromEntries([...form].filter(([, v]) => v !== ""));
    let after = "";
    let count = 0;
    try {
      do {
        const response = await apiResponse(
          queryPath(`/v1/admin/reports/${type}`, {
            ...filters,
            after,
            limit: 2000,
          }),
        );
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-${++count}.${filters.format || "csv"}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        const next = response.headers.get("x-next-cursor") || "";
        if (next === after && next)
          throw new Error(
            "Export returned a repeated cursor. Download stopped.",
          );
        after = next;
      } while (after);
      setMessage(
        `Downloaded ${count} file${count === 1 ? "" : "s"}. Each file is one export page.`,
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        Export {type}
      </summary>
      <form onSubmit={download} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {type === "riders"
            ? "Exports primary-role riders. Each page is downloaded as a separate file."
            : "Dates use Africa/Lagos calendar days, up to 366 days. Each page is downloaded as a separate file."}
        </p>
        <div className="flex flex-wrap gap-4">
          {type === "accounts" && (
            <label className="space-y-2 text-sm">
              Account type
              <select
                name="type"
                className="block h-10 rounded-md border bg-card px-3"
              >
                <option value="users">Users</option>
                <option value="riders">Riders</option>
              </select>
            </label>
          )}
          {type === "riders" ? (
            <label className="space-y-2 text-sm">
              Format
              <select
                name="format"
                className="block h-10 rounded-md border bg-card px-3"
              >
                {["csv", "pdf", "xlsx"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          ) : (
            <>
              {["from", "to"].map((name) => (
                <label key={name} className="space-y-2 text-sm">
                  {human(name)}
                  <Input name={name} type="date" />
                </label>
              ))}
            </>
          )}
        </div>
        {error != null && <ErrorNotice error={error} />}
        <p role="status" className="text-sm">
          {message}
        </p>
        <Button disabled={busy}>
          {busy ? "Exporting…" : "Download export"}
        </Button>
      </form>
    </details>
  );
}
