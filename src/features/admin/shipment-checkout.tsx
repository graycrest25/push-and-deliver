import { useState, type ReactNode } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import type { RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DataStatus } from "@/components/ui/data-status";
import { IconCopy, IconExternalLink, IconRefresh } from "@tabler/icons-react";
import { InformationCard, display } from "./shared";

export function checkoutUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
function Checkout({
  assessment,
  reload,
  loading,
  actions,
}: {
  assessment: RecordData;
  reload: () => void;
  loading: boolean;
  actions?: ReactNode;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const state = [
    assessment.paymentStatus,
    assessment.paymentState,
    assessment.status,
  ];
  const superseded = state.includes("superseded");
  const cancelled = state.includes("cancelled");
  const credited = state.includes("refunded");
  const settled =
    state.includes("paid") || assessment.checkoutStatus === "settled";
  const status = assessment.checkoutStatus;
  const url =
    status === "ready" && !superseded && !credited && !settled && !cancelled
      ? checkoutUrl(assessment.authorizationUrl)
      : undefined;
  const inactive = superseded || credited || settled || cancelled;
  const label = credited
    ? "Wallet credited"
    : superseded
      ? "Replaced"
      : cancelled
        ? "Cancelled"
        : settled
          ? "Paid"
          : assessment.status === "due"
            ? "Payment due"
            : "Processing";
  const id = assessment.assessmentId || assessment.id;
  return (
    <article
      className="min-w-0 space-y-4 py-5"
      aria-label={
        id ? `Assessment · ${String(id).slice(-8)}` : "Assessment processing"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            {assessment.kind === "initial" ||
            assessment.assessmentType === "initial"
              ? "Initial shipment charge"
              : "Shipment charge"}
          </h3>
          {(assessment.amountMinor ?? assessment.totalAmountMinor) != null && (
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {display(
                assessment.amountMinor ?? assessment.totalAmountMinor,
                "amountMinor",
                assessment.currency || "NGN",
              )}
            </p>
          )}
          {id && (
            <p className="mt-1 text-xs text-muted-foreground">
              Assessment · {String(id).slice(-8)}
            </p>
          )}
        </div>
        <DataStatus
          value={label}
          label={label}
          tone={
            settled || credited
              ? "positive"
              : inactive
                ? "neutral"
                : "attention"
          }
        />
      </div>
      <div className="space-y-3">
        {credited ? (
          <p className="text-sm text-muted-foreground">
            Extra payment credited to the customer’s wallet. This is not a bank
            or card refund.
          </p>
        ) : superseded ? (
          <p className="text-sm text-muted-foreground">
            This checkout has been superseded. Use the current payment
            information.
          </p>
        ) : cancelled ? (
          <p className="text-sm text-muted-foreground">
            This assessment was cancelled. No payment is needed for this charge.
          </p>
        ) : settled ? (
          <p className="text-sm text-muted-foreground">
            Payment confirmed. Refresh shipment details while the payment update
            finishes.
          </p>
        ) : status === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Preparing payment link
          </p>
        ) : status === "review_required" ? (
          <p className="text-sm text-muted-foreground">
            Payment link requires review.
          </p>
        ) : status === "not_required" ? (
          <p className="text-sm text-muted-foreground">
            No payable link is needed.
          </p>
        ) : url ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={loading}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopyStatus("Payment link copied.");
                  } catch {
                    setCopyStatus(
                      "Could not copy the link. Use Open payment link instead.",
                    );
                  }
                }}
              >
                <IconCopy aria-hidden="true" />
                Copy payment link
              </Button>
              {!loading && (
                <Button asChild variant="outline">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <IconExternalLink aria-hidden="true" />
                    Open payment link
                  </a>
                </Button>
              )}
            </div>
            <p className="max-w-2xl text-xs text-muted-foreground">
              Share this link to collect payment. Payment remains due until
              confirmed. The link is also queued for email to the customer.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Payment link is not available yet.
          </p>
        )}
        {copyStatus && (
          <p role="status" className="text-sm">
            {copyStatus}
          </p>
        )}
        <Button
          variant="ghost"
          className="-ml-3"
          disabled={loading}
          onClick={reload}
        >
          <IconRefresh aria-hidden="true" />
          Refresh payment status
        </Button>
      </div>
      {!inactive && actions && (
        <div className="divide-y border-t">{actions}</div>
      )}
      {(assessment.paymentId || assessment.reference) && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            Payment reference details
          </summary>
          <dl className="mt-3 space-y-2">
            {assessment.paymentId && (
              <div>
                <dt>Payment ID</dt>
                <dd className="break-all">{assessment.paymentId}</dd>
              </div>
            )}
            {assessment.reference && (
              <div>
                <dt>Payment reference</dt>
                <dd className="break-all">{assessment.reference}</dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </article>
  );
}
export function ShipmentCheckoutPanels({
  data,
  result,
  pending,
  reload,
  loading,
  renderActions,
}: {
  data: RecordData | null;
  result?: RecordData;
  pending?: boolean;
  reload: () => void;
  loading: boolean;
  renderActions?: (assessment: RecordData) => ReactNode;
}) {
  const { adminType } = useCurrentUser();
  if (!canOperate(adminType)) return null;
  const assessments: RecordData[] = Array.isArray(data?.assessments)
    ? data.assessments
    : [];
  const items = assessments.map((assessment) => {
    if (assessment.id !== result?.assessmentId) return assessment;
    // Detail can briefly lag a replacement response. Never restore the old URL.
    if (
      result?.paymentId &&
      assessment.paymentId !== result.paymentId &&
      assessment.status === "due"
    )
      return {
        ...assessment,
        ...result,
        status: assessment.status,
        paymentState: result.paymentState,
        paymentStatus: result.paymentStatus,
      };
    return { ...result, ...assessment };
  });
  if (
    result &&
    !assessments.some((assessment) => assessment.id === result.assessmentId)
  ) {
    items.unshift({
      ...result,
      ...(pending ? { checkoutStatus: "pending" } : {}),
      ...(data?.payment?.status === "paid" && !result.assessmentId
        ? { checkoutStatus: "settled" }
        : {}),
    });
  }
  if (!items.length) return null;
  return (
    <InformationCard title="Customer shipment assessments">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Collect payment and track each shipment charge here. A payment link is
        ready to use only when it appears below.
      </p>
      <div className="divide-y">
        {items.map((assessment, index) => (
          <Checkout
            key={`${assessment.assessmentId || assessment.id || index}:${assessment.checkoutStatus}:${assessment.authorizationUrl || ""}`}
            assessment={assessment}
            reload={reload}
            loading={loading}
            actions={renderActions?.(assessment)}
          />
        ))}
      </div>
    </InformationCard>
  );
}
