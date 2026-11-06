import { useCurrentUser } from "@/contexts/UserContext";
import { segment, type RecordData } from "@/lib/api";
import { toast } from "sonner";
import { ActionForm, RecordView } from "./shared";
import { reason, reasonField } from "./workflow-fields";

function canCancel(data: RecordData) {
  // Support both native status names and retained numeric ride statuses.
  // Unknown statuses fail closed; completed (3) and cancelled (4) are excluded.
  return [
    "requested",
    "accepted",
    "onroute",
    "riderarrived",
    "expired",
    "0",
    "1",
    "2",
    "5",
    "6",
  ].includes(String(data.status).toLowerCase());
}

export function RideCommands({
  data,
  reload,
}: {
  data: RecordData;
  reload: () => void;
}) {
  const { adminType } = useCurrentUser();
  if (adminType !== "super" || !canCancel(data)) return null;
  const path = `/v1/admin/rides/${segment(data.id)}`;
  return (
    <ActionForm
      action={{
        title: "Cancel ride",
        path: `${path}/cancel`,
        description:
          "Cancellation is final and is available before or after delivery starts. For wallet rides with an assigned rider, the rider receives normal earnings and the customer is not automatically refunded. For unassigned wallet rides, the customer is refunded. Cash payments are left for review. Dispute refunds remain a separate financial action.",
        fields: [{ ...reasonField, label: "Cancellation reason" }],
        body: (values) => ({ reason: reason(values.reason) }),
        versionPath: path,
        minimumVersion: 0,
        refreshBeforeSubmit: true,
        preserveRetry: true,
        validateCurrent: (current) => {
          if (!canCancel(current))
            throw new Error(
              "This ride can no longer be cancelled. Refresh the order details to review its current status.",
            );
        },
        renderCurrent: (current) => (
          <RecordView
            scope="rides"
            data={{ status: current.status, version: current.version }}
          />
        ),
        success: "Ride cancelled.",
      }}
      onSuccess={() => {
        toast.success("Ride cancelled.");
        reload();
      }}
    />
  );
}
