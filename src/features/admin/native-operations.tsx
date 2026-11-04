import { AccountSummary } from "./account-summary";
import { ShipmentTimeline } from "./shipment-commands";
import { WithdrawalExport } from "./withdrawal-export";
import { ShipmentDetails } from "./shipment-details";
import { shipmentStatuses, shipmentStatusLabel } from "@/lib/shipment-status";
import { Badge } from "@/components/ui/badge";
import {
  RecordSkeleton,
  ShipmentSkeleton,
} from "@/components/ui/loading-skeletons";
import { RefreshButton } from "@/components/ui/refresh-button";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import { apiResponse, ApiError, queryPath, segment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
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
          <label className="block space-y-2 text-sm">
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
          <label className="block space-y-2 text-sm">
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
          <div role="region" aria-label="Order totals">
            <ResourcePanel
              title="Order totals"
              path={queryPath("/v1/admin/analytics/order-summary", {
                type: order,
              })}
            />
          </div>
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
          key: "items",
          paging: "cursor",
          columns: [
            { key: "id", label: "Shipment ID" },
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
                <Badge variant="secondary">
                  {shipmentStatusLabel(row.status)}
                </Badge>
              ),
            },
            { key: "totalAmountMinor", label: "Total amount" },
            { key: "createdAt", label: "Created at" },
          ],
          filters: [
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
      {record.error ? (
        <ErrorNotice error={record.error} retry={record.reload} />
      ) : record.loading ? (
        <ShipmentSkeleton />
      ) : (
        record.data && (
          <>
            <ShipmentDetails data={record.data} reload={record.reload} />
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
  return (
    <div className="space-y-6">
      <Heading
        title="Withdrawals"
        description="Manual company bank payments. Claim a request before making its transfer."
      />
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
      <WithdrawalExport />
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
  const { adminType } = useCurrentUser();
  const [cursors, setCursors] = useState([""]);
  const cursor = cursors[cursors.length - 1];
  const root = `/v1/admin/jobs/${segment(id)}`;
  const record = useResource(
    queryPath(root, { attemptsLimit: 25, attemptsCursor: cursor }),
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="space-y-6">
      <Heading
        title="Referrals"
        description="Referral attribution and totals. Export dates include both selected days in Africa/Lagos."
      />
      <ResourcePanel
        title="Referral totals"
        path="/v1/admin/referrals/summary"
      />
      <DataList
        spec={{
          path: "/v1/admin/referrals",
          key: "items",
          paging: "cursor",
          pageSizes: [10, 20, 30, 50],
          columns: cols(
            "id",
            "referredUid",
            "referrerUid",
            "referreduserType",
            "referralCodeUsed",
            "createdAt",
          ),
          filters: [
            field("referredUid", "Referred user ID"),
            field("referreduserType", "Referred user type"),
            field("referralCodeUsed", "Referral code"),
          ],
        }}
      />
      <form
        className="space-y-4 rounded-xl border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const data = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError(null);
          try {
            if (String(data.startDate) > String(data.endDate))
              throw new Error("End date must be on or after the start date.");
            const response = await apiResponse(
              queryPath("/v1/admin/referrals/export.csv", data),
            );
            saveBlob(
              await response.blob(),
              `referrals-${data.startDate}-${data.endDate}.csv`,
            );
          } catch (failure) {
            setError(failure);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="text-lg font-semibold">Export referrals</h2>
        <div className="flex flex-wrap gap-4">
          {[
            ["startDate", "Start date"],
            ["endDate", "End date"],
          ].map(([name, label]) => (
            <label className="space-y-2 text-sm" key={name}>
              {label}
              <Input name={name} type="date" required />
            </label>
          ))}
          <label className="space-y-2 text-sm">
            Referred user type (optional)
            <Input name="referreduserType" maxLength={100} />
          </label>
        </div>
        {error != null && <ErrorNotice error={error} />}
        <Button disabled={busy}>
          {busy ? "Exporting…" : "Download referral CSV"}
        </Button>
      </form>
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
