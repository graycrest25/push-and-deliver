import { useCurrentUser } from "@/contexts/UserContext";
import { segment, type RecordData } from "@/lib/api";
import { ActionForm, select } from "./shared";
import { reason, reasonField } from "./workflow-fields";

export function HistoricalStatusCommands({
  kind,
  data,
  reload,
}: {
  kind: "rides" | "shipments";
  data: RecordData;
  reload: () => void;
}) {
  const { adminType } = useCurrentUser();
  if (adminType !== "super" || data.historicalStatusEditable !== true)
    return null;
  const statuses = Array.isArray(data.allowedHistoricalStatuses)
    ? data.allowedHistoricalStatuses.filter(
        (status: unknown): status is string =>
          typeof status === "string" && !!status,
      )
    : [];
  const root = `/v1/admin/${kind}/${segment(data.id)}`;
  return (
    <ActionForm
      key={`${data.id}:${data.version}:${data.sourceVersion}`}
      action={{
        title: "Change historical status",
        path: `${root}/historical-status`,
        description:
          "Historical status changes do not pay the rider, charge the customer or issue refunds. This updates the operational record only; historical financial repricing remains unavailable.",
        fields: [
          select("targetStatus", statuses, "Historical status"),
          reasonField,
        ],
        versionPath:
          kind === "rides" ? root : `/v1/shipments/${segment(data.id)}`,
        refreshBeforeSubmit: true,
        preserveRetry: true,
        bodyWithCurrent: (values, current) => {
          if (
            current.historicalStatusEditable !== true ||
            !Array.isArray(current.allowedHistoricalStatuses) ||
            !current.allowedHistoricalStatuses.includes(values.targetStatus)
          )
            throw new Error(
              "This historical status change is no longer available. Refresh the details and choose an allowed status.",
            );
          if (
            typeof current.sourceVersion !== "string" ||
            !current.sourceVersion.length
          )
            throw new Error(
              "A current source version is required. Refresh the details before saving.",
            );
          return {
            expectedVersion: current.version,
            expectedSourceVersion: current.sourceVersion,
            targetStatus: values.targetStatus,
            reason: reason(values.reason),
          };
        },
        success: "Historical status updated. No payment or refund was issued.",
      }}
      onSuccess={reload}
    />
  );
}
