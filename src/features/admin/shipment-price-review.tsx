import { useCurrentUser } from "@/contexts/UserContext";
import { segment, type RecordData } from "@/lib/api";
import { ActionForm, field } from "./shared";
import { integer, moneyField, reason, reasonField } from "./workflow-fields";

function canReview(data: RecordData) {
  return (
    data.allowedAdminActions?.includes("review_price") &&
    data.readOnly !== true &&
    data.nativeWriteEligible !== false &&
    data.historicalStatusEditable !== true
  );
}

export function ShipmentPriceReview({
  data,
  onSuccess,
}: {
  data: RecordData;
  onSuccess: (result: RecordData) => void;
}) {
  const { adminType } = useCurrentUser();
  if (adminType !== "super" || !canReview(data)) return null;
  return (
    <ActionForm
      action={{
        title: "Review shipment price",
        path: `/v1/admin/shipments/${segment(data.id)}/price-reviews`,
        versionPath: `/v1/shipments/${segment(data.id)}`,
        refreshBeforeSubmit: true,
        preserveRetry: true,
        description:
          "Enter the full revised gross price, not the additional charge. Review the returned payment-due or refund outcome after saving. Customers can pay a due assessment from their wallet in the customer app.",
        fields: [
          field("newWeightKg", "Reweighed weight (kg)", {
            type: "number",
            min: 0.001,
            step: 0.001,
          }),
          moneyField(
            "revisedGrossAmountMinor",
            "Full revised gross price (kobo)",
          ),
          reasonField,
        ],
        validateCurrent: (current) => {
          if (!canReview(current))
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
