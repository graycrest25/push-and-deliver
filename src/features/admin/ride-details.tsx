import type { RecordData } from "@/lib/api";
import { RecordSkeleton } from "@/components/ui/loading-skeletons";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { InformationCard, Notice, RecordView, display } from "./shared";
export function RideDetailsSkeleton() {
  return (
    <div className="space-y-6">
      {[
        "Order information",
        "Customer and receiver",
        "Rider and vehicle",
        "Locations",
        "Payment information",
        "Dates",
      ].map((title) => (
        <InformationCard key={title} title={title}>
          <RecordSkeleton fields={title === "Order information" ? 6 : 4} />
        </InformationCard>
      ))}
    </div>
  );
}
export function RideDetails({ data }: { data: RecordData }) {
  const hidePayment = ["cancelled", "expired", 4, 5, "4", "5"].includes(
    data.status,
  );
  return (
    <div className="space-y-6">
      {data.dataQuality === "incomplete" && (
        <InformationCard title="Data availability">
          <Notice>
            This retained ride has incomplete details. Missing fields:{" "}
            {(data.unavailableFields || [])
              .map((name: string) =>
                name.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " "),
              )
              .join(", ")}
            . Available information is shown below; missing amounts remain
            unavailable.
          </Notice>
        </InformationCard>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Order status", display(data.status, "status", "NGN", "rides")],
          [
            "Payment type",
            hidePayment ? "—" : display(data.payment?.method, "paymentMethod"),
          ],
          [
            "Total amount",
            display(
              data.pricing?.totalAmountMinor,
              "totalAmountMinor",
              data.pricing?.currency || "NGN",
            ),
          ],
        ].map(([label, value]) => (
          <Card className="status-panel" key={label}>
            <CardHeader>
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-lg font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>
      <InformationCard title="Order information">
        <RecordView
          scope="rides"
          data={{
            id: data.id,
            service: data.service,
            rideType: data.rideType,
            status: data.status,
            vehicleType: data.vehicleType,
          }}
        />
      </InformationCard>
      <InformationCard title="Customer and receiver">
        <RecordView
          data={{ customerId: data.customerId, receiver: data.receiver }}
        />
      </InformationCard>
      <InformationCard title="Rider and vehicle">
        {data.assignedRider ? (
          <RecordView
            data={{
              riderId: data.assignedRider.id,
              name: data.assignedRider.name,
              phone: data.assignedRider.phone,
              vehicle: data.assignedRider.vehicle,
            }}
          />
        ) : (
          <Notice>
            {data.assignedRider === null
              ? "No rider is assigned to this order."
              : "Rider assignment information is unavailable."}
          </Notice>
        )}
      </InformationCard>
      <InformationCard title="Locations">
        <RecordView
          data={{
            pickupAddress: data.pickup?.address,
            dropoffAddress: data.dropoff?.address,
            estimatedDistanceMeters: data.estimatedDistanceMeters,
            estimatedDurationSeconds: data.estimatedDurationSeconds,
          }}
        />
      </InformationCard>
      <InformationCard title="Payment information">
        <div className="space-y-4">
          <RecordView
            data={{
              grossAmountMinor: data.pricing?.grossAmountMinor,
              discountAmountMinor: data.pricing?.discountAmountMinor,
              totalAmountMinor: data.pricing?.totalAmountMinor,
              currency: data.pricing?.currency,
              ...(!hidePayment
                ? {
                    paymentStatus: data.payment?.status,
                    paymentMethod: data.payment?.method,
                  }
                : {}),
              transactionId: data.payment?.transactionId,
            }}
          />
          {data.tip && <RecordView data={{ tip: data.tip }} />}
        </div>
      </InformationCard>
      <InformationCard title="Dates">
        <RecordView
          data={{
            createdAt: data.createdAt,
            completedAt: data.completedAt,
            cancelledAt: data.cancelledAt,
            cancellationReason: data.cancellationReason,
          }}
        />
      </InformationCard>
    </div>
  );
}
