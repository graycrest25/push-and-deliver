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
}: {
  data: RecordData;
  reload: () => void;
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
        ["confirm_arrival", "dispatch", "complete_delivery"].includes(action),
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
    if (allowed.has(code))
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
        description: `Confirm receipt of exactly ${assessment.amountMinor} NGN kobo against this assessment. This records escrow funding and cannot be toggled back to unpaid.`,
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
    fields: [
      select("assessmentType", ["initial", "additional_fee"], "Charge type"),
      moneyField("amountMinor", "Charge (kobo)"),
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
      amountMinor: integer(values.amountMinor),
      currency: "NGN",
      assessmentType: values.assessmentType,
      ...(values.newWeightKg !== undefined
        ? { newWeightKg: values.newWeightKg }
        : {}),
    }),
  });
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
              onSuccess={() => {
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
