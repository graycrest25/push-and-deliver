import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, queryPath, type RecordData } from "@/lib/api";
import { enumLabel, readableEnum } from "@/lib/enum-labels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  ActionForm,
  ErrorNotice,
  Heading,
  InformationCard,
  Notice,
  display,
} from "./shared";
const reports = [
  "account_summary",
  "order_summary",
  "referral_summary",
  "user_activation",
  "order_facts",
  "coupon_reporting",
];
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value.toLocaleString("en-NG")
    : "Unavailable";
const queueLabels: Record<string, string> = {
  completed: "Completed",
  running: "Running",
  pending: "Queued",
  dead: "Failed",
  missing: "Missing queue job",
};
export function ReportCoveragePage() {
  const [search, setSearch] = useSearchParams();
  const value = search.get("report");
  const report = value && reports.includes(value) ? value : reports[0];
  return (
    <div className="space-y-6">
      <Heading
        title="Report coverage"
        description="Check source capture, analytics processing and the latest backfill before relying on totals."
      />
      <CoverageRecord
        key={report}
        report={report}
        select={(next) => setSearch({ report: next })}
      />
    </div>
  );
}
function CoverageRecord({
  report,
  select,
}: {
  report: string;
  select: (report: string) => void;
}) {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [jobId, setJobId] = useState("");
  const [watching, setWatching] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const deadline = useRef(0);
  const controller = useRef<AbortController>();
  const beginWatching = useCallback(() => {
    deadline.current = Date.now() + 120000;
    setTimedOut(false);
    setWatching(true);
  }, []);
  const load = useCallback(async () => {
    if (controller.current && !controller.current.signal.aborted) return;
    const request = new AbortController();
    controller.current = request;
    setRefreshing(true);
    try {
      const result = await api(
        queryPath("/v1/admin/analytics/coverage", { report }),
        { signal: request.signal },
      );
      if (!request.signal.aborted) {
        setData(result);
        setError(null);
      }
    } catch (failure) {
      if (!request.signal.aborted) setError(failure);
    } finally {
      if (controller.current === request) {
        controller.current = undefined;
        if (!request.signal.aborted) setRefreshing(false);
      }
    }
  }, [report]);
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);
  const coverage = data?.coverage || {};
  const diagnostics = data?.diagnostics || {};
  const last = data?.lastBackfill;
  const complete = coverage.complete === true;
  const running = ["pending", "running"].includes(last?.queueStatus);
  const failed = last?.queueStatus === "dead" || last?.status === "failed";
  useEffect(() => {
    if (complete || failed) setWatching(false);
    else if ((running || jobId) && !watching && !timedOut) beginWatching();
  }, [complete, failed, running, jobId, watching, timedOut, beginWatching]);
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(() => {
      if (Date.now() >= deadline.current) {
        setWatching(false);
        setTimedOut(true);
        return;
      }
      void load();
    }, 10000);
    return () => clearInterval(timer);
  }, [watching, load]);
  const refresh = () => {
    if (!complete && !failed && (running || jobId)) beginWatching();
    void load();
  };
  const requirements: { title: string; text: string; ready: boolean | null }[] =
    [
      {
        title: "Successful backfill",
        text:
          diagnostics.successfulBackfill === true
            ? "Completed successfully"
            : diagnostics.successfulBackfill === false
              ? "Backfill required"
              : "Unavailable",
        ready:
          typeof diagnostics.successfulBackfill === "boolean"
            ? diagnostics.successfulBackfill
            : null,
      },
      {
        title: "Current source capture",
        text:
          typeof diagnostics.capturePending === "number"
            ? diagnostics.capturePending === 0
              ? "All current changes captured"
              : `${count(diagnostics.capturePending)} changes pending`
            : "Unavailable",
        ready:
          typeof diagnostics.capturePending === "number"
            ? diagnostics.capturePending === 0
            : null,
      },
      {
        title: "Analytics processing",
        text:
          typeof diagnostics.projectionPending === "number"
            ? diagnostics.projectionPending === 0
              ? "All captured changes processed"
              : `${count(diagnostics.projectionPending)} changes pending`
            : "Unavailable",
        ready:
          typeof diagnostics.projectionPending === "number"
            ? diagnostics.projectionPending === 0
            : null,
      },
    ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full space-y-2 sm:w-80">
          <Label htmlFor="coverage-report">Report</Label>
          <select
            id="coverage-report"
            className="h-10 w-full rounded-md border bg-card px-3 text-sm"
            value={report}
            onChange={(event) => select(event.target.value)}
          >
            {reports.map((name) => (
              <option key={name} value={name}>
                {enumLabel("report", name)}
              </option>
            ))}
          </select>
        </div>
        <RefreshButton onClick={refresh} loading={refreshing}>
          Refresh coverage
        </RefreshButton>
      </div>
      {error != null && <ErrorNotice error={error} retry={refresh} />}
      {!data && refreshing && (
        <RecordSkeleton label="Loading report coverage…" fields={9} />
      )}
      {data && (
        <>
          <InformationCard
            title="Source readiness"
            action={
              <Badge variant={complete ? "secondary" : "outline"}>
                {complete
                  ? "Complete"
                  : coverage.complete === false
                    ? "Not ready"
                    : "Unavailable"}
              </Badge>
            }
          >
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {complete
                  ? "This report’s source coverage is complete."
                  : coverage.complete === false
                    ? "This report is not ready for complete business totals. Keep unavailable summaries visible until readiness is confirmed."
                    : "Coverage readiness is unavailable. Totals must not be assumed complete."}
              </p>
              <dl className="grid gap-5 md:grid-cols-3">
                {requirements.map((item) => (
                  <div key={item.title} className="space-y-2">
                    <dt className="text-sm font-medium">{item.title}</dt>
                    <dd className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">
                        {item.ready === true
                          ? "Ready"
                          : item.ready === false
                            ? "Pending"
                            : "Unknown"}
                      </Badge>
                      {item.text}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                <p>
                  Basis:{" "}
                  {coverage.basis === "active_postgres_records"
                    ? "Current PostgreSQL records"
                    : coverage.basis
                      ? readableEnum(coverage.basis)
                      : "Unavailable"}
                </p>
                <p>
                  {coverage.updatedAt
                    ? `Updated ${display(coverage.updatedAt, "updatedAt")}`
                    : "Update time unavailable"}{" "}
                  · {coverage.timezone || "Timezone unavailable"}
                </p>
              </div>
            </div>
          </InformationCard>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <InformationCard title="Processing diagnostics">
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {[
                  ["Authoritative records", diagnostics.authoritativeRecords],
                  ["Captured records", diagnostics.capturedRecords],
                  ["Capture pending", diagnostics.capturePending],
                  ["Projection pending", diagnostics.projectionPending],
                ].map(([label, value]) => (
                  <div key={String(label)} className="space-y-1">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      {count(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </InformationCard>
            <InformationCard
              title="Latest backfill"
              action={
                last && (
                  <Badge variant="outline">
                    {last.status ? readableEnum(last.status) : "Unknown"}
                  </Badge>
                )
              }
            >
              {last ? (
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-sm text-muted-foreground">
                      Queue status
                    </dt>
                    <dd className="text-sm font-medium">
                      {queueLabels[last.queueStatus] ||
                        (last.queueStatus
                          ? readableEnum(last.queueStatus)
                          : "Unavailable")}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm text-muted-foreground">
                      Processed records
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      {count(last.processed)}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm text-muted-foreground">
                      Job attempts
                    </dt>
                    <dd className="text-sm">{count(last.attempts)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm text-muted-foreground">Completed</dt>
                    <dd className="text-sm">
                      {last.completedAt
                        ? display(last.completedAt, "completedAt")
                        : "Not completed"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No backfill history was returned for this report.
                </p>
              )}
            </InformationCard>
          </div>
          {failed && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
            >
              The analytics worker job failed. Investigate the failed queue job
              before requesting another rebuild.
            </div>
          )}
          {watching && (
            <Notice>
              <p role="status">
                Checking readiness every 10 seconds for up to 2 minutes.{" "}
                {jobId && (
                  <>
                    Accepted job: <span>{jobId}</span>.{" "}
                  </>
                )}
                Acceptance does not mean the report is ready.
              </p>
            </Notice>
          )}
          {timedOut && !complete && !failed && (
            <Notice>
              <p role="status">
                Automatic checks stopped after 2 minutes. The report remains
                unavailable until coverage is complete.
              </p>
              <Button className="mt-3" variant="outline" onClick={refresh}>
                Continue checking readiness
              </Button>
            </Notice>
          )}
          {running && !failed && !watching && !timedOut && (
            <Notice>
              A rebuild is already queued or running. Check readiness before
              requesting another.
            </Notice>
          )}
          {!failed &&
            !running &&
            !watching &&
            (report !== "order_summary" || !complete) && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Report maintenance</h2>
                <ActionForm
                  action={{
                    title:
                      report === "order_summary"
                        ? "Rebuild order reports"
                        : "Queue report rebuild",
                    path: "/v1/admin/analytics/backfills",
                    preserveRetry: true,
                    operationScope:
                      typeof last?.completedAt === "string"
                        ? last.completedAt
                        : "no-completed-backfill",
                    description:
                      report === "order_summary"
                        ? "Rebuilds both shipment and ride/courier summaries in one background job. Totals remain unavailable until readiness is confirmed."
                        : "Queues a background rebuild. Acceptance does not mean the report is ready.",
                    body: () => ({
                      report,
                      resume: report === "order_summary" ? false : true,
                    }),
                    success:
                      "Report rebuild accepted. Readiness checks are running.",
                  }}
                  onSuccess={(result) => {
                    setJobId(
                      typeof result.jobId === "string" ? result.jobId : "",
                    );
                    beginWatching();
                    void load();
                  }}
                />
              </section>
            )}
          {report === "order_summary" && complete && <OrderTotals />}
        </>
      )}
    </div>
  );
}
function OrderTotals() {
  const [results, setResults] = useState<PromiseSettledResult<RecordData>[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController>();
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const values = await Promise.allSettled(
      ["shipment", "ride-courier"].map((type) =>
        api(queryPath("/v1/admin/analytics/order-summary", { type }), {
          signal: controller.signal,
        }),
      ),
    );
    if (!controller.signal.aborted) {
      setResults(values);
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);
  return (
    <InformationCard
      title="Order totals"
      action={
        <RefreshButton loading={busy} onClick={() => void refresh()}>
          Refresh order totals
        </RefreshButton>
      }
    >
      <div className="space-y-4">
        {!results.length && (
          <RecordSkeleton label="Refreshing order summaries…" fields={2} />
        )}
        <dl className="grid gap-5 sm:grid-cols-2">
          {results.map((result, index) => (
            <div className="space-y-2" key={index}>
              <dt className="text-sm font-medium">
                {index === 0 ? "Shipments" : "Rides and courier"}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">
                {result.status === "fulfilled"
                  ? count(result.value.total)
                  : "Unavailable"}
              </dd>
              {result.status === "rejected" && (
                <ErrorNotice error={result.reason} />
              )}
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          Only successful summary responses supply totals.{" "}
          <Link to="/dashboard" className="text-primary underline">
            Open overview
          </Link>
        </p>
      </div>
    </InformationCard>
  );
}
