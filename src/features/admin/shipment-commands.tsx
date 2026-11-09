import { canOperate } from "@/lib/admin-access";
import { HistoricalStatusCommands } from "./historical-status-commands";
import { useCurrentUser } from "@/contexts/UserContext";
import { segment, type RecordData } from "@/lib/api";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ActionForm,
  DataList,
  InformationCard,
  Notice,
  field,
  select,
  type Action,
} from "./shared";
import { integer, moneyField, reasonField, version } from "./workflow-fields";
function shipmentReason(value: unknown) {
  const text = String(value || "").trim();
  if (!text || new TextEncoder().encode(text).length > 500)
    throw new Error("Enter a reason of 1–500 UTF-8 bytes.");
  return text;
}
function chargeInKobo(value: unknown) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Enter a naira amount with up to two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 100000000000)
    throw new Error("Enter a charge of no more than ₦1,000,000,000.");
  return amount;
}
const evidence = (name: string, label: string, multiple = false) =>
  field(name, label, {
    type: multiple ? "assets" : "asset",
    purpose: "shipment_evidence",
  });
function eventTime(value: string, createdAt: string) {
  const stamp = Date.parse(value);
  if (
    !Number.isFinite(stamp) ||
    stamp < Date.parse(createdAt) ||
    stamp > Date.now() + 60000
  )
    throw new Error(
      "Use an actual event time after creation and no more than one minute ahead.",
    );
  return new Date(stamp).toISOString();
}
export function ShipmentCommands({
  data,
  reload,
  onCheckoutResult,
  assessmentPending = false,
}: {
  data: RecordData;
  reload: () => void;
  onCheckoutResult?: (result: RecordData, pending: boolean) => void;
  assessmentPending?: boolean;
}) {
  const { adminType } = useCurrentUser();
  if (!canOperate(adminType)) return null;
  if (adminType === "super" && data.historicalStatusEditable === true)
    return (
      <HistoricalStatusCommands kind="shipments" data={data} reload={reload} />
    );
  const path = `/v1/shipments/${segment(data.id)}`,
    root = `/v1/admin/shipments/${segment(data.id)}`;
  const allowed = new Set<string>(
    (data.allowedAdminActions || []).filter(
      (action: string) =>
        adminType === "super" ||
        [
          "confirm_arrival",
          "dispatch",
          "complete_delivery",
          "request_payment_link",
        ].includes(action),
    ),
  );
  if (
    adminType !== "super" &&
    allowed.size === 0 &&
    !data.onwardDeliveryBlockers?.length
  )
    return null;
  const pending =
    data.pendingCommands?.assignment || data.pendingCommands?.assessment;
  if (
    data.readOnly === true ||
    !data.nativeWriteEligible ||
    !Number.isSafeInteger(data.version) ||
    data.version < 1 ||
    pending
  )
    return (
      <InformationCard title="Update shipment status">
        <Notice>
          {pending
            ? "An assignment or assessment is processing. Refresh after the pending work finishes."
            : "This shipment is currently available for inspection only."}
        </Notice>
      </InformationCard>
    );
  const actions: Action[] = [];
  const fence = (values: RecordData) => ({
    expectedVersion: version(data),
    reason: shipmentReason(values.reason),
  });
  const add = (code: string, action: Action) => {
    if (allowed.has(code) && !(code === "assessment" && assessmentPending))
      actions.push({ ...action, versionPath: path, preserveRetry: true });
  };
  add("accept_at_office", {
    title: "Accept at office",
    path: `${path}/accept`,
    description: "Confirm office intake. This does not assign a chosen rider.",
    body: () => ({ expectedVersion: version(data) }),
  });
  for (const [code, title, targetStatus] of [
    ["confirm_arrival", "Confirm office arrival", "sentToHq"],
    ["dispatch", "Out for final delivery", "onrouteToDestination"],
    [
      "complete_delivery",
      "Delivered to final destination",
      "deliveredToDestination",
    ],
  ])
    add(code, {
      title,
      path: `${root}/transitions`,
      body: () => ({ expectedVersion: version(data), targetStatus }),
    });
  add("cancel", {
    title: "Cancel shipment",
    path: `${path}/cancel`,
    description: "Cancellation is final; a required refund may remain pending.",
    fields: [{ ...reasonField, label: "Cancellation reason" }],
    body: fence,
  });
  add("assign_rider", {
    title: data.assignedRider ? "Reassign rider" : "Assign rider",
    path: `${root}/assignment`,
    description:
      "The selected rider must be active, verified, online, located and eligible. Assignment does not verify pickup.",
    fields: [
      field("riderId", "Selected rider", { riderSelection: true }),
      reasonField,
    ],
    body: (values) => ({ ...fence(values), riderId: values.riderId.trim() }),
  });
  add("correct_status", {
    title: "Correct office dispatch status",
    path: `${root}/status-corrections`,
    initial: {
      targetStatus:
        data.status === "sentToHq" ? "onrouteToDestination" : "sentToHq",
    },
    description:
      "Only the office dispatch states can be corrected. Review the current record and supply supporting evidence.",
    fields: [
      select(
        "targetStatus",
        ["sentToHq", "onrouteToDestination"],
        "Corrected status",
      ),
      evidence("evidenceAssetIds", "Correction evidence", true),
      reasonField,
    ],
    body: (values) => ({
      ...fence(values),
      targetStatus: values.targetStatus,
      evidenceAssetIds: uniqueEvidence(values.evidenceAssetIds),
    }),
  });
  const due = (data.assessments || []).filter(
    (row: RecordData) => row.status === "due",
  );
  if (allowed.has("record_cash_receipt"))
    for (const assessment of due)
      add("record_cash_receipt", {
        title: `Record cash receipt · ${assessment.id.slice(-8)}`,
        path: `${root}/cash-receipts`,
        refreshBeforeSubmit: true,
        reconcileBeforeRetry: true,
        validateCurrent: (current) => {
          if (
            !current.allowedAdminActions?.includes("record_cash_receipt") ||
            !current.assessments?.some(
              (item: RecordData) =>
                item.id === assessment.id &&
                item.status === "due" &&
                item.amountMinor === assessment.amountMinor,
            )
          )
            throw new Error(
              "The due assessment changed. Refresh the shipment before recording customer cash.",
            );
        },
        description: `Confirm receipt of exactly ₦${(assessment.amountMinor / 100).toFixed(2)} against this assessment. This records escrow funding and cannot be toggled back to unpaid.`,
        initial: { amountMinor: assessment.amountMinor },
        fields: [
          moneyField("amountMinor", "Confirm amount received (kobo)"),
          field("reference", "Cash receipt reference", { maxLength: 128 }),
          field("receivedAt", "Received at", { type: "datetime-local" }),
          evidence("evidenceAssetId", "Cash receipt evidence"),
          reasonField,
        ],
        body: (values) => {
          if (integer(values.amountMinor, 1) !== assessment.amountMinor)
            throw new Error(
              "The received amount must match the authoritative due assessment exactly.",
            );
          if (
            values.reference !== values.reference.trim() ||
            /[\r\n\x00-\x1f]/.test(values.reference) ||
            new TextEncoder().encode(values.reference).length > 128
          )
            throw new Error(
              "Use a 1–128 byte reference without surrounding whitespace or control characters.",
            );
          return {
            ...fence(values),
            assessmentId: assessment.id,
            amountMinor: assessment.amountMinor,
            currency: "NGN",
            reference: values.reference,
            receivedAt: eventTime(values.receivedAt, data.createdAt),
            evidenceAssetId: values.evidenceAssetId,
          };
        },
      });
  add("assessment", {
    title: "Assess shipment charge",
    path: `${root}/assessment`,
    expectedStatus: [200, 202],
    refreshBeforeSubmit: true,
    reconcileBeforeRetry: true,
    validateCurrent: (current) => {
      if (
        !current.allowedAdminActions?.includes("assessment") ||
        current.pendingCommands?.assessment
      )
        throw new Error(
          "Assessment is no longer available. Refresh the shipment before continuing.",
        );
    },
    initial: {
      amountNaira:
        (data.pricing?.grossAmountMinor ?? data.pricing?.totalAmountMinor) ==
        null
          ? ""
          : (data.pricing.grossAmountMinor ?? data.pricing.totalAmountMinor) /
            100,
      newWeightKg: data.weightKg ?? "",
    },
    fields: [
      select("assessmentType", ["initial", "additional_fee"], "Charge type"),
      field("amountNaira", "Charge (₦)", {
        type: "number",
        min: 0,
        max: 1000000000,
        step: 0.01,
        help: "Enter the amount in naira, with up to two decimal places.",
      }),
      field("newWeightKg", "Corrected weight (kg)", {
        type: "number",
        min: 0.001,
        step: 0.001,
        required: false,
      }),
      reasonField,
    ],
    body: (values) => ({
      ...fence(values),
      amountMinor: chargeInKobo(values.amountNaira),
      currency: "NGN",
      assessmentType: values.assessmentType,
      ...(values.newWeightKg !== undefined
        ? { newWeightKg: values.newWeightKg }
        : {}),
    }),
  });
  if (allowed.has("request_payment_link"))
    for (const assessment of due) {
      for (const replace of [false, true]) {
        if (replace && !assessment.paymentId) continue;
        add("request_payment_link", {
          title: `${replace ? "Generate new payment link" : "Get payment link"} · ${assessment.id.slice(-8)}`,
          description: replace
            ? "Request a replacement for the current checkout. The backend verifies abandonment with the payment provider; closing checkout alone does not prove abandonment. The new link is queued for email automatically."
            : "Get checkout for this existing bill without changing its amount. This is not a resend-email operation.",
          path: `${root}/assessment/checkout`,
          expectedStatus: [200, 202],
          refreshBeforeSubmit: true,
          reconcileBeforeRetry: true,
          errorMessages: {
            checkout_not_abandoned:
              "This checkout cannot be replaced yet. Refresh its payment status before retrying.",
          },
          validateCurrent: (current) => {
            const bill = current.assessments?.find(
              (item: RecordData) =>
                item.id === assessment.id && item.status === "due",
            );
            if (
              !current.allowedAdminActions?.includes("request_payment_link") ||
              !bill
            )
              throw new Error(
                "This bill is no longer payable. Refresh the shipment.",
              );
            if (replace && !bill.paymentId)
              throw new Error(
                "This assessment has no current payment to replace. Refresh and use Get payment link.",
              );
          },
          bodyWithCurrent: (_values, current) => {
            const bill = current.assessments.find(
              (item: RecordData) =>
                item.id === assessment.id && item.status === "due",
            );
            return {
              expectedVersion: version(current),
              assessmentId: bill.id,
              ...(replace ? { replacePaymentId: bill.paymentId } : {}),
            };
          },
        });
      }
    }
  add("edit_customs", {
    title: "Edit customs intake",
    path: `${root}/customs`,
    method: "PUT",
    initial: {
      clearanceType: data.clearanceType || "sea",
      description: data.description || "",
    },
    description:
      "Intake changes are available before assessment or payment. Only changed fields are submitted.",
    fields: [
      select("clearanceType", ["sea", "air"], "Clearance type"),
      field("description", "Goods description", {
        type: "textarea",
        maxLength: 2000,
      }),
      ...(
        ["documentAssetId", "invoiceAssetId", "packingListAssetId"] as const
      ).map((name, index) =>
        field(name, ["Customs document", "Invoice", "Packing list"][index], {
          type: "asset",
          required: false,
          purpose: (["customs_document", "invoice", "packing_list"] as const)[
            index
          ],
        }),
      ),
      reasonField,
    ],
    body: (values) => {
      const changes: RecordData = {};
      for (const key of ["clearanceType", "description"])
        if (values[key] !== data[key]) changes[key] = values[key];
      for (const key of [
        "documentAssetId",
        "invoiceAssetId",
        "packingListAssetId",
      ])
        if (values[key]) changes[key] = values[key];
      if (!Object.keys(changes).length)
        throw new Error("Change at least one intake field.");
      return { ...fence(values), changes };
    },
  });
  add("complete_clearance", {
    title: "Complete clearance with evidence",
    path: `${root}/complete-clearance`,
    description:
      "Complete a paid clearance-only case. This settles office revenue without parcel delivery or rider settlement.",
    fields: [
      evidence("evidenceAssetIds", "Clearance evidence", true),
      field("completedAt", "Completed at", { type: "datetime-local" }),
      reasonField,
    ],
    body: (values) => ({
      ...fence(values),
      evidenceAssetIds: uniqueEvidence(values.evidenceAssetIds),
      completedAt: eventTime(values.completedAt, data.createdAt),
    }),
  });
  add("dispatch_local_direct", {
    title: "Dispatch direct local delivery",
    path: `${root}/local-dispatch`,
    description:
      "Use after rider-verified pickup. This skips office intake while retaining the current rider assignment through delivery.",
    fields: [reasonField],
    body: fence,
  });
  return (
    <InformationCard title="Update shipment status">
      <div className="space-y-4">
        {assessmentPending && (
          <Notice>
            Assessment processing. Refresh shipment details before creating
            another assessment.
          </Notice>
        )}
        {(data.onwardDeliveryBlockers || []).map((blocker: string) => (
          <Notice key={blocker}>
            {(
              {
                customer_payment_required:
                  "Customer payment must be completed before onward delivery.",
                assessment_payment_required:
                  "An outstanding shipment assessment must be paid.",
              } as Record<string, string>
            )[blocker] ||
              "Onward delivery is currently blocked. Refresh the shipment for updated requirements."}
          </Notice>
        ))}
        {!!data.onwardDeliveryBlockers?.length && (
          <p className="text-sm text-muted-foreground">
            Confirming the rider’s HQ cash receipt does not pay the customer’s
            bill. Use the shipment assessment and customer payment controls to
            settle outstanding charges.
          </p>
        )}
        {allowed.has("assign_rider") && (
          <Link to="/riders" className="text-sm text-primary underline">
            Open rider directory
          </Link>
        )}
        {actions.length ? (
          actions.map((action) => (
            <ActionForm
              key={`${data.id}:${data.version}:${action.title}`}
              action={action}
              onSuccess={(result, responseStatus) => {
                if (
                  action.path === `${root}/assessment` ||
                  action.path === `${root}/assessment/checkout`
                )
                  onCheckoutResult?.(result, responseStatus === 202);

                toast.success(
                  "Shipment command accepted. Loading current details.",
                );
                reload();
              }}
            />
          ))
        ) : (
          <Notice>
            {data.clearanceStatus === "completed"
              ? "Clearance completed. No further changes are available."
              : ["deliveredToDestination", "cancelled"].includes(data.status)
                ? "This shipment is complete. No further status changes are available."
                : "No status update is available for the current shipment state."}
          </Notice>
        )}
        {allowed.has("record_cash_receipt") && !due.length && (
          <Notice>
            No authoritative due assessment is available. Refresh before
            recording a cash receipt.
          </Notice>
        )}
      </div>
    </InformationCard>
  );
}
function uniqueEvidence(values: string[]) {
  if (
    !values.length ||
    values.length > 5 ||
    new Set(values).size !== values.length
  )
    throw new Error("Provide 1–5 distinct ready evidence files.");
  return values;
}
export function ShipmentTimeline({ id }: { id: string }) {
  return (
    <DataList
      spec={{
        title: "Shipment status history",
        path: `/v1/admin/shipments/${segment(id)}/timeline`,
        paging: "cursor",
        key: "items",
        columns: [
          { key: "status" },
          { key: "action" },
          { key: "occurredAt" },
          { key: "actorUid" },
          { key: "reason" },
          { key: "evidenceAssetIds" },
        ],
        note: "Historical actors or reasons may be unavailable.",
      }}
    />
  );
}
