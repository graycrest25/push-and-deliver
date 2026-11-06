import type { RecordData } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Notice, RecordView } from "./shared";
import { approvalRequirements } from "./approval-requirements";
export function ApprovalChecklist({
  application,
  current = false,
}: {
  application: RecordData;
  current?: boolean;
}) {
  const checks = approvalRequirements(application),
    missing = checks.filter((check) => !check.ready);
  return (
    <section
      className="space-y-4"
      aria-label={
        current ? "Current approval requirements" : "Approval requirements"
      }
    >
      {current && (
        <RecordView
          data={{
            applicationId: application.applicationId,
            status: application.status,
            version: application.version,
          }}
        />
      )}
      <Notice>
        {missing.length
          ? `${missing.length} approval blocker(s) need attention. Correct them and refresh the application before approving.`
          : "The application reports no approval blockers."}
      </Notice>
      <ul className="space-y-3">
        {checks.map((check) => (
          <li
            key={check.label}
            className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
          >
            <span className="text-sm">{check.label}</span>
            <Badge variant={check.ready ? "secondary" : "destructive"}>
              {check.ready ? "Ready" : "Needs attention"}
            </Badge>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Approval eligibility and blockers come from the current application.
      </p>
    </section>
  );
}
