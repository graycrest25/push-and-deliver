import { useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import type { RecordData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { InformationCard, display } from "./shared";

function checkoutUrl(value: unknown) {
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
}: {
  assessment: RecordData;
  reload: () => void;
  loading: boolean;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const state = [
    assessment.paymentStatus,
    assessment.paymentState,
    assessment.status,
  ];
  const superseded = state.includes("superseded");
  const credited = state.includes("refunded");
  const settled =
    state.includes("paid") || assessment.checkoutStatus === "settled";
  const status = assessment.checkoutStatus;
  const url =
    status === "ready" && !superseded && !credited && !settled
      ? checkoutUrl(assessment.authorizationUrl)
      : undefined;
  return (
    <InformationCard
      title={
        assessment.assessmentId || assessment.id
          ? `Assessment · ${String(assessment.assessmentId || assessment.id).slice(-8)}`
          : "Assessment processing"
      }
    >
      <div className="space-y-3">
        {(assessment.amountMinor ?? assessment.totalAmountMinor) != null && (
          <p className="font-semibold">
            Assessment amount:{" "}
            {display(
              assessment.amountMinor ?? assessment.totalAmountMinor,
              "amountMinor",
              assessment.currency || "NGN",
            )}
          </p>
        )}
        {assessment.status && (
          <p className="text-sm">Assessment status: {assessment.status}</p>
        )}
        {credited ? (
          <p>
            Extra payment credited to the customer’s wallet. This is not a bank
            or card refund.
          </p>
        ) : superseded ? (
          <p>
            This checkout has been superseded. Use the current payment
            information.
          </p>
        ) : settled ? (
          <p>
            Payment confirmed. Refresh shipment details while the payment update
            finishes.
          </p>
        ) : status === "pending" ? (
          <p>Preparing payment link</p>
        ) : status === "review_required" ? (
          <p>Payment link requires review.</p>
        ) : status === "not_required" ? (
          <p>No payable link is needed.</p>
        ) : url ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
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
                Copy payment link
              </Button>
              {!loading && (
                <Button asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Open payment link
                  </a>
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              A ready link does not mean the customer has paid or that email
              delivery is complete. The backend queues the link to the
              customer’s registered email.
            </p>
          </>
        ) : (
          <p>Payment link is not available yet.</p>
        )}
        {copyStatus && (
          <p role="status" className="text-sm">
            {copyStatus}
          </p>
        )}
        {assessment.paymentId && (
          <p className="break-all text-sm">
            Payment ID: {assessment.paymentId}
          </p>
        )}
        {assessment.reference && (
          <p className="break-all text-sm">
            Payment reference: {assessment.reference}
          </p>
        )}
        <Button variant="outline" disabled={loading} onClick={reload}>
          Refresh payment status
        </Button>
      </div>
    </InformationCard>
  );
}
export function ShipmentCheckoutPanels({
  data,
  result,
  pending,
  reload,
  loading,
}: {
  data: RecordData | null;
  result?: RecordData;
  pending?: boolean;
  reload: () => void;
  loading: boolean;
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
    <section aria-label="Customer shipment assessments" className="space-y-4">
      <h2 className="text-lg font-semibold">Customer shipment assessments</h2>
      {items.map((assessment, index) => (
        <Checkout
          key={`${assessment.assessmentId || assessment.id || index}:${assessment.checkoutStatus}:${assessment.authorizationUrl || ""}`}
          assessment={assessment}
          reload={reload}
          loading={loading}
        />
      ))}
    </section>
  );
}
