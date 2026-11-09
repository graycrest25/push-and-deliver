import { FeatureTabs } from "./feature-tabs";
import { ShipmentCheckoutPanels } from "./shipment-checkout";
import {
  riderEarnings,
  riderPaymentMethod,
  riderPaymentStatus,
  riderTaskStatus,
  riderConfirmation,
} from "./shipment-rider-payment";
import { ShipmentPriceReview } from "./shipment-price-review";
import { AccountSummary } from "./account-summary";
import { OrderSummary } from "./order-summary";
import { ShipmentTimeline } from "./shipment-commands";
import { WithdrawalExport } from "./withdrawal-export";
import { ShipmentDetails } from "./shipment-details";
import { shipmentStatuses, shipmentStatusLabel } from "@/lib/shipment-status";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataStatus } from "@/components/ui/data-status";
import {
  RecordSkeleton,
  ShipmentSkeleton,
} from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import {
  apiResponse,
  ApiError,
  queryPath,
  segment,
  type RecordData,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InformationCard,
  Heading,
  Notice,
  ErrorNotice,
  DataList,
  ResourcePanel,
  RecordView,
  ActionForm,
  useResource,
  field,
  select,
  type Action,
} from "./shared";

const cols = (...keys: string[]) => keys.map((key) => ({ key }));
const reason = field("reason", "Reason", { type: "textarea", maxLength: 500 });
function checkedReason(value: string, minimum = 10) {
  const reason = value.trim();
  const bytes = new TextEncoder().encode(reason).length;
  if (bytes < minimum || bytes > 500)
    throw new Error(`Enter a reason of ${minimum}–500 bytes.`);
  return reason;
}
export function NativeSummaries({
  section = "all",
}: {
  section?: "all" | "accounts" | "orders";
}) {
  const { adminType } = useCurrentUser();
  const verifier = adminType === "verifier";
  const [account, setAccount] = useState(verifier ? "riders" : "users");
  const [order, setOrder] = useState("shipment");
  return (
    <div className="space-y-6">
      {section !== "orders" && (
        <section className="space-y-3" aria-label="Account summary">
          <label
            className="analytics-selector-label block space-y-2 text-sm"
            data-tone="info"
          >
            Account summary
            <select
              className="block h-10 w-full rounded-md border bg-card px-3 sm:w-64"
              value={verifier ? "riders" : account}
              onChange={(e) => setAccount(e.target.value)}
            >
              {!verifier && <option value="users">Users</option>}
              <option value="riders">Riders</option>
            </select>
          </label>
          <AccountSummary
            key={verifier ? "riders" : account}
            type={verifier || account === "riders" ? "riders" : "users"}
          />
        </section>
      )}
      {section !== "accounts" && !verifier && (
        <section className="space-y-3" aria-label="Order summary">
          <label
            className="analytics-selector-label block space-y-2 text-sm"
            data-tone="teal"
          >
            Order summary
            <select
              className="block h-10 w-full rounded-md border bg-card px-3 sm:w-64"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            >
              {[
                ["shipment", "Shipments"],
                ["ride-courier", "Rides and courier"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <OrderSummary key={order} type={order} />
          {adminType === "super" && (
            <Link
              className="inline-flex text-sm text-primary underline"
              to="/analytics-coverage?report=order_summary"
            >
              Check order report readiness
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
function ReportCoverageLink() {
  const { adminType } = useCurrentUser();
  return adminType === "super" ? (
    <Button asChild variant="outline">
      <Link to="/analytics-coverage">Inspect report coverage</Link>
    </Button>
  ) : null;
}
export function NativeDashboard() {
  return (
    <div className="space-y-6">
      <Heading
        title="Overview"
        description="Account and order totals. Dates use Africa/Lagos; unavailable reports can be retried after their source data is prepared."
      />
      <NativeSummaries />
      <ReportCoverageLink />
    </div>
  );
}
export function NativeSummaryPage() {
  return (
    <div className="space-y-6">
      <Heading
        title="Account and order reports"
        description="Current reporting totals, with the calculation time returned by the service."
      />
      <NativeSummaries />
      <ReportCoverageLink />
    </div>
  );
}
export function NativeShipments() {
  return (
    <div className="space-y-6">
      <Heading
        title="Shipment orders"
        description="Find a shipment and inspect its current details."
      />
      <DataList
        spec={{
          path: "/v1/shipments",
          search: {
            param: "orderId",
            label: "Search shipment order ID",
            placeholder: "Paste the full shipment ID",
            help: "Use the full ID, not the shortened shipment number. Matching is exact and case-sensitive; other filters still apply.",
          },
          key: "items",
          paging: "cursor",
          columns: [
            { key: "id", label: "Shipment ID" },
            { key: "originCity", label: "Origin city" },
            {
              key: "shipmentType",
              label: "Shipment type",
              render: (row) =>
                ({
                  local: "Local",
                  express: "Express",
                  customs_clearance: "Customs clearance",
                })[String(row.shipmentType)] ||
                String(row.shipmentType || "Unknown"),
            },
            {
              key: "status",
              render: (row) => (
                <DataStatus
                  value={row.status}
                  label={shipmentStatusLabel(row.status)}
                  scope="/v1/shipments"
                />
              ),
            },
            { key: "totalAmountMinor", label: "Total amount" },
            {
              key: "riderAmountMinor",
              label: "Rider pickup earnings",
              render: riderEarnings,
            },
            {
              key: "riderPaymentMethod",
              label: "Rider payment method",
              render: (row) => riderPaymentMethod(row.riderPayment?.method),
            },
            {
              key: "riderPaymentStatus",
              label: "Rider payment status",
              render: (row) => riderPaymentStatus(row.riderPayment?.status),
            },
            {
              key: "riderTaskStatus",
              label: "Rider task status",
              render: (row) => riderTaskStatus(row.riderTaskStatus),
            },
            {
              key: "riderConfirmedAt",
              label: "Confirmation time",
              render: (row) => riderConfirmation(row.riderPayment?.confirmedAt),
            },
            { key: "createdAt", label: "Created at" },
          ],
          filters: [
            select("city", ["lagos", "ibadan", "unknown"], "Origin city"),
            select(
              "shipmentType",
              ["local", "express", "customs_clearance"],
              "Shipment type",
            ),
            {
              ...select("status", Object.keys(shipmentStatuses), "Status"),
              optionLabels: shipmentStatuses,
            },
          ],
          note: "City filters use the shipment’s origin. Historical shipments without a clear origin city are shown as Unknown.",
          link: (r) => `/shipment-orders/${segment(r.id)}`,
        }}
      />
    </div>
  );
}
export async function downloadAsset(id: string) {
  const response = await apiResponse(`/v1/media/${segment(id)}/content`);
  saveBlob(await response.blob(), `document-${id}`);
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function NativeShipment() {
  const { id = "" } = useParams();
  const record = useResource(`/v1/shipments/${segment(id)}`);
  const [priceResult, setPriceResult] = useState<{
    id: string;
    result: RecordData;
  } | null>(null);
  const [checkout, setCheckout] = useState<{
    id: string;
    result: RecordData;
    pending: boolean;
    version: number;
  } | null>(null);
  const checkoutResult = checkout?.id === id ? checkout : null;
  const paymentRefresh = useRef({ record, checkoutResult });
  paymentRefresh.current = { record, checkoutResult };
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      const { record: latest, checkoutResult: saved } = paymentRefresh.current;
      if (latest.loading) return;
      const bills: RecordData[] = latest.data?.assessments || [];
      const bill = bills.find((item) => item.id === saved?.result.assessmentId);
      const needsRefresh =
        bills.some((item) => item.checkoutStatus === "pending") ||
        (!!saved &&
          ((!bill &&
            (saved.pending || saved.result.checkoutStatus === "pending")) ||
            (!!saved.result.paymentId &&
              bill?.status === "due" &&
              bill.paymentId !== saved.result.paymentId)));
      if (!needsRefresh || attempts >= 12) {
        clearInterval(timer);
        return;
      }
      attempts++;
      latest.reload();
    }, 7000);
    return () => clearInterval(timer);
  }, [
    id,
    checkoutResult?.result.operationId,
    checkoutResult?.result.paymentId,
    checkoutResult?.result.checkoutStatus,
  ]);
  const currentAssessment = record.data?.assessments?.find(
    (item: RecordData) => item.id === checkoutResult?.result.assessmentId,
  );
  useEffect(() => {
    if (
      checkoutResult?.result.paymentId &&
      currentAssessment?.paymentId === checkoutResult.result.paymentId &&
      currentAssessment.checkoutStatus &&
      currentAssessment.checkoutStatus !== "pending"
    )
      setCheckout(null);
  }, [checkoutResult, currentAssessment]);
  const assessmentPending =
    !!checkoutResult?.pending &&
    !(
      currentAssessment?.checkoutStatus &&
      currentAssessment.checkoutStatus !== "pending"
    ) &&
    !(
      record.data &&
      record.data.version > checkoutResult.version &&
      record.data.pendingCommands?.assessment === false
    );
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary underline" to="/shipment-orders">
        Back to shipments
      </Link>
      <Heading title="Shipment details" description={id}>
        <RefreshButton onClick={record.reload} loading={record.loading}>
          Refresh
        </RefreshButton>
      </Heading>
      {priceResult?.id === id && (
        <InformationCard title="Price review outcome">
          <RecordView data={priceResult.result} />
        </InformationCard>
      )}
      <ShipmentCheckoutPanels
        data={record.data}
        result={checkoutResult?.result}
        pending={assessmentPending}
        reload={record.reload}
        loading={record.loading}
      />
      {record.error ? (
        <ErrorNotice error={record.error} retry={record.reload} />
      ) : record.loading ? (
        <ShipmentSkeleton />
      ) : (
        record.data && (
          <>
            <ShipmentPriceReview
              data={record.data}
              onSuccess={(result) => {
                setPriceResult({ id, result });
                record.reload();
              }}
            />
            <ShipmentDetails
              data={record.data}
              reload={record.reload}
              assessmentPending={assessmentPending}
              onCheckoutResult={(result, pending) =>
                setCheckout({
                  id,
                  result,
                  pending,
                  version: record.data!.version,
                })
              }
            />
            <ShipmentTimeline id={id} />
            <ShipmentTracking id={id} status={record.data.status} />
          </>
        )
      )}
    </div>
  );
}
function ShipmentTracking({ id, status }: { id: string; status: unknown }) {
  const active =
    status === 1 ||
    status === 6 ||
    status === "1" ||
    status === "6" ||
    status === "acceptedByRider" ||
    status === "onRouteToPndHQ";
  const tracking = useResource(
    active ? `/v1/shipments/${segment(id)}/tracking` : null,
  );
  if (!active)
    return (
      <Notice>Live tracking is available during active pickup states.</Notice>
    );
  if (tracking.error instanceof ApiError && tracking.error.status === 404)
    return (
      <Notice>
        Live location is not available for this shipment right now.
      </Notice>
    );
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Live tracking</h2>
      {tracking.loading ? (
        <RecordSkeleton label="Loading location…" />
      ) : tracking.error ? (
        <ErrorNotice error={tracking.error} retry={tracking.reload} />
      ) : (
        <RecordView data={tracking.data} />
      )}
    </section>
  );
}
export function NativeWithdrawals() {
  const { adminType } = useCurrentUser();
  return (
    <div className="space-y-6">
      <Heading
        title="Withdrawals"
        description="Manual company bank payments. Claim a request before making its transfer."
      />
      <FeatureTabs
        label="Withdrawal sections"
        sections={[
          {
            id: "requests",
            label: "Requests",
            content: (
              <DataList
                spec={{
                  path: "/v1/admin/withdrawals",
                  key: "items",
                  paging: "cursor",
                  columns: cols(
                    "id",
                    "amountMinor",
                    "status",
                    "assignedToMe",
                    "accountNumberMasked",
                    "createdAt",
                  ),
                  filters: [
                    select("status", [
                      "requested",
                      "approved",
                      "succeeded",
                      "cancelled",
                    ]),
                  ],
                  link: (r) => `/withdrawals/${segment(r.id)}`,
                }}
              />
            ),
          },
          ...(canOperate(adminType)
            ? [{ id: "export", label: "Export", content: <WithdrawalExport /> }]
            : []),
        ]}
      />
    </div>
  );
}
export function NativeWithdrawal() {
  const { id = "" } = useParams();
  const { adminType } = useCurrentUser();
  const root = `/v1/admin/withdrawals/${segment(id)}`;
  const record = useResource(root);
  const [showBank, setShowBank] = useState(false);
  const data = record.data;
  const actions: Action[] = [];
  if (data && canOperate(adminType)) {
    if (data.status === "requested")
      actions.push({
        title: "Claim for payment",
        path: `${root}/approve`,
        fields: [reason],
        body: (v) => ({ reason: checkedReason(v.reason) }),
        description:
          "Reserves this request for you. Make the transfer separately from the company bank account.",
        success: "Request claimed. Check the bank details before transferring.",
      });
    if (
      data.status === "requested" ||
      (data.status === "approved" && data.assignedToMe === true)
    )
      actions.push({
        title: "Reject unpaid request",
        path: `${root}/reject`,
        fields: [reason],
        body: (v) => ({ reason: checkedReason(v.reason) }),
        description:
          "Releases the reserved funds. Only reject when you have confirmed that no payment was made.",
      });
    if (data.status === "approved" && data.assignedToMe === true)
      actions.push({
        title: "Record successful bank transfer",
        preserveRetry: true,
        path: `${root}/mark-successful`,
        fields: [
          field("transferReference", "Bank transfer reference", {
            maxLength: 128,
          }),
          field("paidAt", "Payment time (include timezone)", {
            help: "Use the bank-confirmed time, for example 2026-11-02T14:30:00+01:00.",
          }),
          reason,
        ],
        body: (v) => {
          const reference = v.transferReference.trim().toUpperCase();
          if (!/^[A-Z0-9][A-Z0-9./_-]{5,127}$/.test(reference))
            throw new Error(
              "Enter the bank reference: 6–128 letters, digits or . / _ -.",
            );
          if (
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
              v.paidAt,
            ) ||
            !Number.isFinite(Date.parse(v.paidAt))
          )
            throw new Error("Enter an RFC3339 payment time with a timezone.");
          if (
            Date.parse(v.paidAt) < Date.parse(data.createdAt) ||
            Date.parse(v.paidAt) > Date.now() + 300000
          )
            throw new Error(
              "Payment time must follow the request and cannot be more than five minutes ahead.",
            );
          return {
            transferReference: reference,
            paidAt: v.paidAt,
            reason: checkedReason(v.reason),
          };
        },
        description:
          "Record only a transfer confirmed by your bank. This action records payment; it does not send money.",
        success: "Bank transfer recorded.",
      });
  }
  return (
    <div className="space-y-6">
      <Heading title="Withdrawal details" description={id}>
        <RefreshButton
          loading={record.loading}
          onClick={() => {
            setShowBank(false);
            record.reload();
          }}
        >
          Refresh
        </RefreshButton>
      </Heading>
      {record.error ? (
        <ErrorNotice error={record.error} retry={record.reload} />
      ) : record.loading ? (
        <RecordSkeleton label="Loading withdrawal…" />
      ) : (
        data && (
          <>
            <RecordView data={data} />
            {data.status === "approved" && (
              <Notice>
                If the bank outcome is uncertain, keep this request claimed
                until the bank statement is reconciled.
              </Notice>
            )}
            {canOperate(adminType) &&
              data.status === "approved" &&
              data.assignedToMe === true && (
                <section className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowBank((v) => !v)}
                  >
                    {showBank
                      ? "Hide bank details"
                      : "Show bank details for payment"}
                  </Button>
                  {showBank && (
                    <ResourcePanel
                      title="Payment destination"
                      path={`${root}/bank-details`}
                    />
                  )}
                </section>
              )}
            {actions.map((action) => (
              <ActionForm
                key={`${id}:${data.status}:${action.title}`}
                action={action}
                onSuccess={() => {
                  setShowBank(false);
                  record.reload();
                }}
              />
            ))}
          </>
        )
      )}
    </div>
  );
}
export function NativeJobs() {
  return (
    <div className="space-y-6">
      <Heading
        title="Background jobs"
        description="Inspect processing failures and review attempts before replaying dead work."
      />
      <DataList
        spec={{
          path: "/v1/admin/jobs",
          key: "items",
          idKey: "jobId",
          paging: "cursor",
          columns: cols(
            "jobId",
            "jobType",
            "status",
            "attemptCount",
            "generation",
            "updatedAt",
          ),
          filters: [
            select("status", [
              "pending",
              "processing",
              "retry_wait",
              "succeeded",
              "dead",
            ]),
            field("jobType", "Job type"),
          ],
          link: (r) => `/jobs/${segment(r.jobId)}`,
        }}
      />
    </div>
  );
}
export function NativeJob() {
  const { id = "" } = useParams();
  return <JobDetails key={id} id={id} />;
}
function JobDetails({ id }: { id: string }) {
  const { adminType } = useCurrentUser();
  const [cursors, setCursors] = useState([""]);
  const cursor = cursors[cursors.length - 1];
  const root = `/v1/admin/jobs/${segment(id)}`;
  const record = useResource(
    queryPath(root, {
      attemptsLimit: DEFAULT_PAGE_SIZE,
      attemptsCursor: cursor,
    }),
  );
  const data = record.data;
  return (
    <div className="space-y-6">
      <Heading title="Background job" description={id}>
        <RefreshButton onClick={record.reload} loading={record.loading}>
          Refresh
        </RefreshButton>
      </Heading>
      {record.error ? (
        <ErrorNotice error={record.error} retry={record.reload} />
      ) : record.loading ? (
        <RecordSkeleton label="Loading job…" />
      ) : (
        data && (
          <>
            <RecordView data={data} />
            <nav aria-label="Attempt history pagination" className="flex gap-2">
              <Button
                variant="outline"
                disabled={cursors.length === 1}
                onClick={() => setCursors((v) => v.slice(0, -1))}
              >
                Previous attempts
              </Button>
              <Button
                variant="outline"
                disabled={
                  !data.attemptsNextCursor ||
                  cursors.includes(data.attemptsNextCursor)
                }
                onClick={() =>
                  setCursors((v) => [...v, data.attemptsNextCursor])
                }
              >
                More attempts
              </Button>
            </nav>
            {canOperate(adminType) &&
              data.status === "dead" &&
              Number.isInteger(data.generation) &&
              data.generation > 0 && (
                <ActionForm
                  key={`${id}:${data.generation}`}
                  action={{
                    title: "Replay dead job",
                    path: `${root}/replay`,
                    fields: [reason],
                    body: (v) => ({
                      reason: checkedReason(v.reason, 5),
                      expectedGeneration: data.generation,
                    }),
                    description:
                      "Requeues this reviewed generation while preserving its deduplication key. Refresh if its state has changed.",
                  }}
                  onSuccess={() => {
                    setCursors([""]);
                    record.reload();
                  }}
                />
              )}
          </>
        )
      )}
    </div>
  );
}
export function NativeReferrals() {
  function referralEmail(row: RecordData, party: "referred" | "referrer") {
    const generated = row.referrerAccountType === null;
    if (party === "referrer" && generated)
      return row.promoterName ? (
        <span>{row.promoterName} (Promoter)</span>
      ) : (
        <span className="text-muted-foreground">Unavailable</span>
      );
    const email = row[`${party}Email`];
    const uid = row[`${party}Uid`];
    if (!email)
      return <span className="text-muted-foreground">Unavailable</span>;
    if (!uid || generated) return <span>{email}</span>;
    return (
      <Link
        to={`/users/${segment(uid)}`}
        className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {email}
      </Link>
    );
  }
  const [tab, setTab] = useState("user");
  const [draft, setDraft] = useState({ startDate: "", endDate: "" });
  const [dates, setDates] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const params = { ...dates, referrerAccountType: tab || undefined };
  const [exportCode, setExportCode] = useState("");
  return (
    <div className="space-y-6">
      <Heading
        title="Referrals"
        description="Filter by who made the referral, not who registered. Dates include both selected days in Africa/Lagos."
      >
        <Button asChild variant="outline">
          <Link to="/promoter-links">Manage promoter links</Link>
        </Button>
      </Heading>
      <ResourcePanel
        title="Global referral totals · all dates and referrers"
        path="/v1/admin/referrals/summary"
      />
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Referral lists"
      >
        {[
          ["user", "User Referrals"],
          ["rider", "Rider Referrals"],
          ["", "All"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={tab === value ? "default" : "outline"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !!draft.startDate !== !!draft.endDate ||
            (draft.startDate && draft.startDate > draft.endDate)
          ) {
            setError(
              new Error(
                "Select both dates, with the end date on or after the start date, or clear both.",
              ),
            );
            return;
          }
          setError(null);
          setDates({ ...draft });
        }}
      >
        {[
          ["startDate", "Start date"],
          ["endDate", "End date"],
        ].map(([name, label]) => (
          <label className="space-y-2 text-sm" key={name}>
            {label}
            <Input
              type="date"
              name={name}
              value={draft[name as keyof typeof draft]}
              onChange={(event) =>
                setDraft({ ...draft, [name]: event.target.value })
              }
            />
          </label>
        ))}
        <Button>Apply dates</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft({ startDate: "", endDate: "" });
            setDates({ startDate: "", endDate: "" });
            setError(null);
          }}
        >
          Clear dates
        </Button>
        <label className="space-y-2 text-sm">
          Referral code for export (optional)
          <Input
            name="exportReferralCode"
            value={exportCode}
            onChange={(event) => setExportCode(event.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const response = await apiResponse(
                queryPath("/v1/admin/referrals/export.csv", {
                  ...params,
                  referralCodeUsed: exportCode.trim() || undefined,
                }),
              );
              saveBlob(
                await response.blob(),
                dates.startDate
                  ? `referrals-${dates.startDate}-${dates.endDate}.csv`
                  : "referrals.csv",
              );
            } catch (failure) {
              setError(failure);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Exporting…" : "Download filtered CSV"}
        </Button>
      </form>
      {error != null && <ErrorNotice error={error} />}
      <DataList
        spec={{
          path: "/v1/admin/referrals",
          key: "items",
          paging: "cursor",
          params,
          pageSizes: [10, 20, 30, 50],
          defaultPageSize: 20,
          filters: [
            field("referredUid", "Referred user ID"),
            field("referralCodeUsed", "Referral code"),
          ],
          columns: [
            { key: "id" },
            {
              key: "referredEmail",
              label: "Referred Email",
              render: (row) => referralEmail(row, "referred"),
            },
            {
              key: "referrerEmail",
              label: "Referrer Email",
              render: (row) => referralEmail(row, "referrer"),
            },
            ...cols("referreduserType", "referralCodeUsed", "createdAt"),
          ],
          note: "CSV uses the selected referrer tab, applied dates and optional export referral code. The list filters below do not affect the CSV. Global totals above do not change with these filters.",
        }}
      />
    </div>
  );
}
export function UnavailableAdminFeature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Heading title={title} />
      <Notice>{children}</Notice>
      <Button asChild variant="outline">
        <Link to="/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
