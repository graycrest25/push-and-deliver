import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { canAccessAdminScreen } from "@/lib/admin-access";
import { apiResponse, segment, type RecordData } from "@/lib/api";
import { shipmentStatuses, shipmentStatusLabel } from "@/lib/shipment-status";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ActionForm,
  ErrorNotice,
  Notice,
  RecordView,
  display,
  field,
  type Action,
  InformationCard,
} from "./shared";

const statusName = (value: unknown) =>
  typeof value === "number" || /^[0-6]$/.test(String(value))
    ? Object.keys(shipmentStatuses)[Number(value)]
    : String(value ?? "");
const friendly = (value: unknown) =>
  typeof value === "string"
    ? value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())
    : display(value);
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <InformationCard title={title}>{children}</InformationCard>;
}
function Fields({ values }: { values: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
      {values.map(([label, value]) => (
        <div className="min-w-0" key={label}>
          <dt className="text-xs font-semibold text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-1 text-sm break-words [overflow-wrap:anywhere]">
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function AccountLink({ id, rider = false }: { id: unknown; rider?: boolean }) {
  const { adminType } = useCurrentUser();
  if (typeof id !== "string" || !id) return <>—</>;
  const path = `/${rider ? "riders" : "users"}/${segment(id)}`;
  return canAccessAdminScreen(adminType, path) ? (
    <Link className="text-primary underline" to={path}>
      {id}
    </Link>
  ) : (
    <>{id}</>
  );
}
export function ShipmentStatusActions({
  data,
  reload,
}: {
  data: RecordData;
  reload: () => void;
}) {
  const { adminType } = useCurrentUser();
  if (adminType !== "super") return null;
  const status = statusName(data.status);
  const knownType = ["local", "express", "customs_clearance"].includes(
    data.shipmentType,
  );
  if (!knownType || !Number.isSafeInteger(data.version) || data.version < 1)
    return (
      <Notice>
        Status changes are unavailable until this shipment has a supported type
        and a current version.
      </Notice>
    );
  const actions: Action[] = [];
  const root = `/v1/shipments/${segment(data.id)}`;
  const transition = (title: string, targetStatus: string) =>
    actions.push({
      title,
      path: `${root}/transitions`,
      preserveRetry: true,
      body: () => ({ expectedVersion: data.version, targetStatus }),
      success: "Shipment updated. Loading its current details.",
    });
  if (status === "placed" && data.assignedRider === null)
    actions.push({
      title: "Accept at office",
      description:
        "Confirm that the shipment is at the office. This does not assign a rider.",
      path: `${root}/accept`,
      preserveRetry: true,
      body: () => ({ expectedVersion: data.version }),
    });
  if (status === "onRouteToPndHQ")
    transition("Confirm receipt at HQ", "sentToHq");
  const paid =
    data.payment?.status === "paid" &&
    ["not_required", "paid"].includes(data.assessmentStatus);
  if (status === "sentToHq" && paid)
    transition("Dispatch to destination", "onrouteToDestination");
  if (status === "onrouteToDestination" && paid)
    transition("Mark delivered to destination", "deliveredToDestination");
  if (["placed", "acceptedByRider"].includes(status))
    actions.push({
      title: "Cancel shipment",
      description:
        "Cancellation is final. If paid, the backend queues a refund; cancellation does not confirm the refund has completed.",
      path: `${root}/cancel`,
      preserveRetry: true,
      fields: [
        field("reason", "Cancellation reason", {
          type: "textarea",
          maxLength: 500,
        }),
      ],
      body: (values) => {
        const reason = values.reason.trim();
        if (!reason || new TextEncoder().encode(reason).length > 500)
          throw new Error("Enter a cancellation reason of 1–500 bytes.");
        return { expectedVersion: data.version, reason };
      },
    });
  return (
    <Section title="Update shipment status">
      <div className="space-y-4">
        {actions.map((action) => (
          <ActionForm
            key={`${data.id}:${data.version}:${action.title}`}
            action={action}
            onSuccess={reload}
          />
        ))}
        {["sentToHq", "onrouteToDestination"].includes(status) && !paid && (
          <Notice>
            Payment must be confirmed and outstanding assessments settled before
            dispatch or delivery.
          </Notice>
        )}
        {status === "acceptedByRider" && (
          <Notice>
            The assigned rider must verify pickup before the shipment can
            proceed to HQ.
          </Notice>
        )}
        {["deliveredToDestination", "cancelled"].includes(status) && (
          <Notice>
            This shipment is complete. No further status changes are available.
          </Notice>
        )}
        {!actions.length &&
          ![
            "acceptedByRider",
            "sentToHq",
            "onrouteToDestination",
            "deliveredToDestination",
            "cancelled",
          ].includes(status) && (
            <Notice>
              No administrator status change is available from this state.
            </Notice>
          )}
      </div>
    </Section>
  );
}
export function ShipmentDetails({
  data,
  reload,
}: {
  data: RecordData;
  reload: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const status = statusName(data.status),
    cancelled = status === "cancelled";
  const customs = data.shipmentType === "customs_clearance";
  const local = data.shipmentType === "local";
  const type = local
    ? "Local"
    : customs
      ? "Customs clearance"
      : data.shipmentType === "express"
        ? "International / express"
        : "Unknown";
  const money = (value: unknown) =>
    display(value, "amountMinor", data.pricing?.currency || "NGN");
  const documents = Object.entries(data.assets || {}).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && !!entry[1],
  );
  async function download(id: string) {
    setBusy(id);
    setError(null);
    try {
      const response = await apiResponse(`/v1/media/${segment(id)}/content`);
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `shipment-document-${id}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{type}</Badge>
        {!cancelled && data.payment?.status && (
          <Badge variant="secondary">{friendly(data.payment.status)}</Badge>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Order status", shipmentStatusLabel(data.status)],
          [
            "Payment type",
            cancelled ? "—" : display(friendly(data.payment?.method)),
          ],
          ["Total amount", money(data.pricing?.totalAmountMinor)],
        ].map(([title, value]) => (
          <Card key={title} className="status-panel">
            <CardHeader>
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold break-words">
              {value}
            </CardContent>
          </Card>
        ))}
      </div>
      <ShipmentStatusActions data={data} reload={reload} />
      <Section title="Order information">
        <Fields
          values={[
            ["Shipment ID", data.id],
            ["Shipment type", type],
            ...(customs
              ? ([
                  ["Clearance type", friendly(data.clearanceType)],
                  ["Assessment status", friendly(data.assessmentStatus)],
                ] as [string, ReactNode][])
              : []),
            ...(local
              ? ([
                  ["Local service", data.localTypeId],
                  ["Local zone", data.localZone],
                  ["State", data.stateId],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
      </Section>
      <Section title="Customer and receiver">
        <Fields
          values={[
            ["Customer ID", <AccountLink id={data.customerId} />],
            ["Customer name", data.sender?.name],
            ["Customer phone", data.sender?.phone],
            ["Sender email", data.sender?.email],
            ...(!customs
              ? ([
                  ["Receiver name", data.receiver?.name],
                  ["Receiver phone", data.receiver?.phone],
                  ["Receiver email", data.receiver?.email],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
      </Section>
      {!customs && (
        <Section title="Locations">
          <Fields
            values={[
              ["Pickup address", data.pickup?.address],
              ["Drop-off address", data.dropoff?.address],
              ["PND office address", data.office?.address],
              ["Country", data.country],
              ["Postal code", data.zipCode],
            ]}
          />
        </Section>
      )}
      <Section
        title={customs ? "Clearance documents" : "Package and documents"}
      >
        <div className="space-y-5">
          {!customs && (
            <Fields
              values={[
                [
                  "Item types",
                  Array.isArray(data.itemTypes)
                    ? data.itemTypes.join(", ") || "No entries"
                    : data.itemTypes,
                ],
                ["Item value", money(data.itemValueMinor)],
                ["Weight (kg)", display(data.weightKg)],
                ["Height (cm)", display(data.dimensionsCm?.height)],
                ["Width (cm)", display(data.dimensionsCm?.width)],
                ["Breadth (cm)", display(data.dimensionsCm?.breadth)],
              ]}
            />
          )}
          {documents.length ? (
            <div className="flex flex-wrap gap-2">
              {documents.map(([name, id]) => (
                <Button
                  key={name}
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void download(id)}
                >
                  {busy === id
                    ? "Downloading…"
                    : `Download ${name
                        .replace(/AssetId$/, "")
                        .replace(/([a-z])([A-Z])/g, "$1 $2")
                        .toLowerCase()}`}
                </Button>
              ))}
            </div>
          ) : (
            <Notice>No documents are available for this shipment.</Notice>
          )}
          {error != null && <ErrorNotice error={error} />}
          {customs && (
            <Notice>
              Customs intake editing and completion with clearance evidence are
              not available yet.
            </Notice>
          )}
        </div>
      </Section>
      <Section title="Payment information">
        <div className="space-y-4">
          <Fields
            values={[
              ["Gross amount", money(data.pricing?.grossAmountMinor)],
              ["Discount", money(data.pricing?.discountAmountMinor)],
              ["Total amount", money(data.pricing?.totalAmountMinor)],
              ...(!cancelled
                ? ([
                    ["Payment status", friendly(data.payment?.status)],
                    ["Payment type", friendly(data.payment?.method)],
                    ["Pay later", display(data.payment?.payLater)],
                  ] as [string, ReactNode][])
                : []),
              ["Transaction reference", data.payment?.transactionId],
            ]}
          />
          {data.refund && <RecordView data={{ refund: data.refund }} />}
          {Array.isArray(data.assessments) && data.assessments.length > 0 && (
            <RecordView data={{ assessments: data.assessments }} />
          )}
        </div>
      </Section>
      <Section title="Rider and vehicle">
        {data.assignedRider ? (
          <Fields
            values={[
              ["Rider ID", <AccountLink id={data.assignedRider.id} rider />],
              ["Rider name", data.assignedRider.name],
              ["Rider phone", data.assignedRider.phone],
            ]}
          />
        ) : (
          <Notice>No rider is assigned to this shipment.</Notice>
        )}
      </Section>
      <Section title="Dates and status history">
        <div className="space-y-4">
          <Fields
            values={[
              ["Created at", display(data.createdAt)],
              ["Updated at", display(data.updatedAt)],
              ["Completed at", display(data.completedAt)],
              ["Cancelled at", display(data.cancelledAt)],
            ]}
          />
          <Notice>
            The complete status history is not available to administrators yet.
          </Notice>
        </div>
      </Section>
    </div>
  );
}
