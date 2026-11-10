import {
  riderEarnings,
  riderPaymentMethod,
  riderPaymentStatus,
  riderTaskStatus,
  riderConfirmation,
} from "./shipment-rider-payment";
import { OfficeHandoffCode } from "./office-handoff-code";
import { ShipmentCommands } from "./shipment-commands";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "@/contexts/UserContext";
import { canAccessAdminScreen } from "@/lib/admin-access";
import { apiResponse, segment, type RecordData } from "@/lib/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
const riderText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "Unavailable";

export const ShipmentStatusActions = ShipmentCommands;
export function ShipmentDetails({
  data,
  reload,
  onCheckoutResult,
  assessmentPending,
  checkoutResult,
  priceResult,
  onPriceReview,
}: {
  data: RecordData;
  reload: () => void;
  onCheckoutResult?: (result: RecordData, pending: boolean) => void;
  assessmentPending?: boolean;
  checkoutResult?: RecordData;
  priceResult?: RecordData;
  onPriceReview?: (result: RecordData) => void;
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
          [
            "Order status",
            data.clearanceStatus === "completed"
              ? "Clearance completed"
              : shipmentStatusLabel(data.status),
          ],
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
      <OfficeHandoffCode data={data} />
      <ShipmentStatusActions
        data={data}
        reload={reload}
        onCheckoutResult={onCheckoutResult}
        assessmentPending={assessmentPending}
        checkoutResult={checkoutResult}
        priceResult={priceResult}
        onPriceReview={onPriceReview}
      />
      <Section title="Order information">
        <Fields
          values={[
            ["Shipment ID", data.id],
            ["Shipment type", type],
            ...(data.pickupOtp != null && String(data.pickupOtp).trim() !== ""
              ? ([["Pickup OTP", String(data.pickupOtp)]] as [
                  string,
                  ReactNode,
                ][])
              : []),
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
        </div>
      </Section>
      <Section title="Rider pickup earnings and payment">
        <Fields
          values={[
            ["Rider pickup earnings", riderEarnings(data)],
            [
              "Rider payment method",
              riderPaymentMethod(data.riderPayment?.method),
            ],
            [
              "Rider payment status",
              riderPaymentStatus(data.riderPayment?.status),
            ],
            ["Rider task status", riderTaskStatus(data.riderTaskStatus)],
            ...(data.riderPayment?.confirmedAt
              ? ([
                  [
                    "Confirmation time",
                    riderConfirmation(data.riderPayment.confirmedAt),
                  ],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Rider earnings and receipt information are separate from the
          customer’s shipment payment and the parcel’s delivery stage.
        </p>
      </Section>
      <Section title="Rider and vehicle">
        {data.assignedRider ? (
          <div className="space-y-4">
            <Avatar className="size-20">
              <AvatarImage
                src={data.assignedRider.imageUrl || undefined}
                alt={`${riderText(data.assignedRider.name)} rider photo`}
                className="object-cover"
              />
              <AvatarFallback className="text-xs">No photo</AvatarFallback>
            </Avatar>
            <Fields
              values={[
                [
                  "Rider ID",
                  data.assignedRider.id ? (
                    <AccountLink id={data.assignedRider.id} rider />
                  ) : (
                    "Unavailable"
                  ),
                ],
                ["Rider name", riderText(data.assignedRider.name)],
                ["Rider phone", riderText(data.assignedRider.phone)],
                [
                  "Vehicle type",
                  data.assignedRider.vehicle?.type === "bike"
                    ? "Motorbike"
                    : riderText(data.assignedRider.vehicle?.type),
                ],
                ["Vehicle color", riderText(data.assignedRider.vehicle?.color)],
                ["Vehicle make", riderText(data.assignedRider.vehicle?.make)],
                ["Vehicle model", riderText(data.assignedRider.vehicle?.model)],
                [
                  "Plate number",
                  riderText(data.assignedRider.vehicle?.plateNumber),
                ],
              ]}
            />
          </div>
        ) : (
          <Notice>No rider is assigned to this shipment.</Notice>
        )}
      </Section>
      <Section title="Dates">
        <div className="space-y-4">
          <Fields
            values={[
              ["Created at", display(data.createdAt)],
              ["Updated at", display(data.updatedAt)],
              [
                "Completed at",
                display(data.clearanceCompletedAt || data.completedAt),
              ],
              ["Cancelled at", display(data.cancelledAt)],
            ]}
          />
        </div>
      </Section>
    </div>
  );
}
