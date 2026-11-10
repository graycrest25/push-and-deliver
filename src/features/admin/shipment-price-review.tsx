import { useCurrentUser } from "@/contexts/UserContext";
import { segment, type RecordData } from "@/lib/api";
import { DataStatus } from "@/components/ui/data-status";
import { ActionForm, display, field, nairaToKobo, RecordView } from "./shared";
import { integer, moneyField, reason, reasonField } from "./workflow-fields";

export function canReviewShipmentPrice(data: RecordData) {
  return (
    data.allowedAdminActions?.includes("review_price") &&
    data.readOnly !== true &&
    data.nativeWriteEligible !== false &&
    data.historicalStatusEditable !== true &&
    !data.pendingCommands?.assessment &&
    !data.pendingCommands?.assignment
  );
}
const money = (value: unknown) => display(value, "amountMinor", "NGN");

function PriceComparison({
  data,
  draft,
}: {
  data: RecordData;
  draft: RecordData;
}) {
  const current = data.pricing?.grossAmountMinor;
  let revised: number | undefined;
  try {
    revised = nairaToKobo(draft.revisedGrossAmountMinor);
  } catch {
    // Incomplete input has no preview; never present it as a zero price.
  }
  const difference =
    typeof current === "number" && revised !== undefined
      ? revised - current
      : undefined;
  return (
    <div
      className="space-y-3 border-y py-4"
      aria-label="Price comparison"
      aria-live="polite"
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "Current full price",
            current == null ? "Unavailable" : money(current),
          ],
          [
            "Revised full price",
            revised === undefined ? "Enter a price" : money(revised),
          ],
          [
            "Price change",
            difference === undefined
              ? "—"
              : difference === 0
                ? "No change"
                : `${money(Math.abs(difference))} ${difference > 0 ? "increase" : "decrease"}`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-2xl text-xs text-muted-foreground">
        These are full prices before discounts. The amount the customer needs to
        pay, or any wallet refund, is confirmed after saving.
      </p>
    </div>
  );
}

export function ShipmentPriceReview({
  data,
  onSuccess,
  pending = false,
}: {
  data: RecordData;
  onSuccess: (result: RecordData) => void;
  pending?: boolean;
}) {
  const { adminType } = useCurrentUser();
  if (adminType !== "super" || !canReviewShipmentPrice(data) || pending)
    return null;
  return (
    <ActionForm
      presentation="inline"
      action={{
        title: "Review shipment price",
        summaryHint:
          "Replace the full shipment price after reweighing or a pricing correction.",
        submitLabel: "Save revised price",
        path: `/v1/admin/shipments/${segment(data.id)}/price-reviews`,
        versionPath: `/v1/shipments/${segment(data.id)}`,
        refreshBeforeSubmit: true,
        preserveRetry: true,
        reconcileBeforeRetry: true,
        description:
          "Enter the new total price for the whole shipment before discounts. Any amount already paid is taken into account automatically.",
        initial: {
          newWeightKg: data.weightKg ?? "",
          revisedGrossAmountMinor: data.pricing?.grossAmountMinor ?? "",
        },
        fields: [
          {
            ...moneyField("revisedGrossAmountMinor", "Full revised price"),
            help: "The entire revised price in naira, before discounts. For example, enter 18,000 as 18000.",
          },
          field("newWeightKg", "Reweighed weight (kg)", {
            type: "number",
            min: 0.001,
            step: 0.001,
          }),
          { ...reasonField, help: "Explain why the full price is changing." },
        ],
        renderPreview: (draft, current) => (
          <PriceComparison data={current || data} draft={draft} />
        ),
        renderCurrent: (current) => (
          <p className="text-sm">
            Current full price: {money(current.pricing?.grossAmountMinor)} ·
            Weight: {current.weightKg ?? "Unavailable"} kg
          </p>
        ),
        validateCurrent: (current) => {
          if (!canReviewShipmentPrice(current))
            throw new Error(
              "Price review is no longer available. Refresh the shipment details.",
            );
        },
        body: (values) => {
          const weight = Number(values.newWeightKg);
          if (!Number.isFinite(weight) || weight <= 0)
            throw new Error("Enter a positive weight in kilograms.");
          return {
            newWeightKg: weight,
            revisedGrossAmountMinor: integer(values.revisedGrossAmountMinor),
            currency: "NGN",
            reason: reason(values.reason),
          };
        },
      }}
      onSuccess={onSuccess}
    />
  );
}

export function ShipmentPriceReviewOutcome({ result }: { result: RecordData }) {
  const review = result.priceReview || result;
  const outcome = review.outcome;
  const messages: Record<string, [string, string]> = {
    payment_due: [
      "Payment due",
      "The revised price is saved. Collect the outstanding amount using the customer assessment below. The customer can also pay from their wallet in the app.",
    ],
    wallet_refund: [
      "Wallet refund",
      "The revised price is saved. The excess payment has been credited to the customer’s wallet.",
    ],
    discount_adjusted: [
      "Discount adjusted",
      "The revised price is saved and the promotion has been adjusted. No wallet refund is due.",
    ],
    unchanged: [
      "No payment change",
      "The review is saved. No additional payment or refund is due.",
    ],
  };
  return (
    <section
      aria-label="Price review outcome"
      className="space-y-3 border-b pb-5"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">Price review outcome</h3>
        <DataStatus
          value={outcome}
          label={messages[outcome]?.[0] || "Review saved"}
          tone={outcome === "payment_due" ? "attention" : "positive"}
        />
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {messages[outcome]?.[1] || "Review the saved pricing details below."}
      </p>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {[
          ["Revised full price", review.revisedGrossAmountMinor],
          ["Total after discount", review.revisedTotalAmountMinor],
          ["Amount to collect", review.amountDueMinor],
          ["Wallet refund", review.walletRefundMinor],
        ]
          .filter(([, value]) => value != null)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {money(value)}
              </dd>
            </div>
          ))}
      </dl>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Review details
        </summary>
        <div className="mt-3">
          <RecordView data={result} />
        </div>
      </details>
    </section>
  );
}
