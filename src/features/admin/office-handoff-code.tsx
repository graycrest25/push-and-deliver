import { useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { canOperate } from "@/lib/admin-access";
import { segment, type RecordData } from "@/lib/api";
import { ActionForm, display } from "./shared";
import { version } from "./workflow-fields";

function HandoffCode({ result }: { result: RecordData }) {
  const [now, setNow] = useState(Date.now());
  const expiry = Date.parse(result.expiresAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired = now >= expiry;
  return (
    <div className="space-y-3">
      {expired ? (
        <p>
          Handoff code expired. Generate a replacement before handing over a
          code.
        </p>
      ) : (
        <>
          <p className="text-sm">HQ handoff code</p>
          <p
            className="text-3xl font-semibold tracking-widest tabular-nums"
            aria-label={`HQ handoff code: ${result.officeHandoffCode}`}
          >
            {result.officeHandoffCode}
          </p>
        </>
      )}
      <p className="text-sm">
        Expires: {display(result.expiresAt, "expiresAt")}
      </p>
      <p className="text-sm">
        The rider must be within {result.radiusMeters} metres of HQ.
      </p>
      <p className="text-sm text-muted-foreground">
        Give this code to the rider only after receiving the parcel at HQ. It
        expires after 10 minutes and allows five incorrect attempts.
      </p>
    </div>
  );
}

export function OfficeHandoffCode({ data }: { data: RecordData }) {
  const { adminType } = useCurrentUser();
  if (
    !canOperate(adminType) ||
    !data.allowedAdminActions?.includes("issue_office_handoff_code")
  )
    return null;
  return (
    <ActionForm
      key={`${data.id}:${data.version}`}
      action={{
        title: "Generate HQ handoff code",
        description:
          "Receive the parcel at HQ before sharing the code with the rider. Generating a code does not change the shipment status or version. The code is not sent in push notifications or shown in customer/rider details.",
        path: `/v1/admin/shipments/${segment(data.id)}/office-handoff-code`,
        versionPath: `/v1/shipments/${segment(data.id)}`,
        preserveRetry: true,
        body: () => ({ expectedVersion: version(data) }),
        validateResult: (result) => {
          if (
            result.id !== data.id ||
            typeof result.officeHandoffCode !== "string" ||
            !/^\d+$/.test(result.officeHandoffCode) ||
            !Number.isFinite(Date.parse(result.expiresAt)) ||
            typeof result.radiusMeters !== "number" ||
            result.radiusMeters < 0
          )
            throw new Error(
              "The handoff code could not be confirmed. Retry with the same operation key.",
            );
        },
        success: "HQ handoff code generated",
        restartLabel: "Generate replacement code",
        renderResult: (result) => <HandoffCode result={result} />,
      }}
    />
  );
}
