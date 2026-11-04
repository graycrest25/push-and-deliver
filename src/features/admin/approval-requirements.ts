import type { RecordData } from "@/lib/api";
export type ApprovalRequirement = { label: string; ready: boolean };
export function approvalRequirements(
  application: RecordData,
): ApprovalRequirement[] {
  const blockers = application.approvalBlockers;
  if (!Array.isArray(blockers))
    return [
      {
        label: "Reload the application to check approval blockers",
        ready: false,
      },
    ];
  return blockers.map((blocker: unknown) => ({
    label: typeof blocker === "string" ? blocker : JSON.stringify(blocker),
    ready: false,
  }));
}
export function assertApprovable(application: RecordData) {
  if (!application.allowedDecisions?.includes("approve"))
    throw new Error(
      "Approval is no longer available for the current application state. Reload the application.",
    );
  const blockers = approvalRequirements(application);
  if (blockers.length)
    throw new Error(
      `Approval requirements need attention: ${blockers.map((check) => check.label).join("; ")}.`,
    );
}
