import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shipmentStatusLabels } from "@/lib/shipment-status";
import { ShipmentOrderStatus, type ShipmentOrder } from "@/types";

const fieldGroups = [
  {
    title: "Order information",
    fields: {
      id: "Document ID",
      shipmentID: "Shipment ID",
      orderStatus: "Order status",
      shipmentType: "Shipment type",
      quoteType: "Quote type",
      localtype: "Local service",
      localzone: "Local zone",
      clearanceType: "Clearance type",
      otp: "Delivery OTP",
    },
  },
  {
    title: "Customer and receiver",
    fields: {
      customerID: "Customer ID",
      customerName: "Customer name",
      customerPhonenumber: "Customer phone",
      senderemailaddress: "Sender email",
      receivername: "Receiver name",
      receiveremail: "Receiver email",
      receiverphonenumber: "Receiver phone",
    },
  },
  {
    title: "Locations",
    fields: {
      startoffAddress: "Pickup address",
      dropoffAddress: "Drop-off address",
      pndofficeaddress: "PnD office address",
      pndofficelocationID: "PnD office ID",
      country: "Country",
      state: "State",
      zipcode: "Postal code",
    },
  },
  {
    title: "Package and documents",
    fields: {
      itemType: "Item types",
      itemvalue: "Item value",
      weightinKG: "Weight (kg)",
      widthinCM: "Width (cm)",
      heightinCM: "Height (cm)",
      breadthinCM: "Breadth (cm)",
      itemImageURL: "Item image",
      itemImage: "Additional item image",
      clearancedocument: "Clearance document",
      packingListUrl: "Packing list",
      invoiceUrl: "Invoice",
    },
  },
  {
    title: "Payment information",
    fields: {
      totalAmount: "Total amount",
      riderAmount: "Rider amount",
      paymentType: "Payment type",
      ispaid: "Paid",
      paylater: "Pay later",
      transactionID: "Transaction ID",
      usedCoupon: "Coupon used",
      couponDiscount: "Coupon discount",
    },
  },
  {
    title: "Rider and vehicle",
    fields: {
      riderID: "Rider ID",
      riderName: "Rider name",
      riderPhoneNumber: "Rider phone",
      riderImageURL: "Rider photo",
      vehicleType: "Vehicle type",
      riderCarName: "Vehicle name",
      riderCarModel: "Vehicle model",
      riderCarColor: "Vehicle color",
      riderCarPlateNumber: "Plate number",
      declinelist: "Declined riders",
    },
  },
  {
    title: "Dates and status history",
    fields: {
      createdAt: "Created at",
      cancelledAt: "Cancelled at",
      completedAt: "Completed at",
      statusTimeline: "Status timeline",
    },
  },
] as const;

const hiddenFields = new Set([
  "quoteid",
  "startofflocation",
  "dropofflocation",
  "pndofficelocation",
  "geolocation",
  "geopoint",
  "geohash",
  "latitude",
  "longitude",
  "latlng",
  "lat",
  "lng",
  "_lat",
  "_long",
]);

function isHiddenField(key: string) {
  return hiddenFields.has(key.toLowerCase());
}

const moneyFields = new Set([
  "totalAmount",
  "riderAmount",
  "couponDiscount",
  "itemvalue",
]);
const imageFields = new Set(["itemImage", "itemImageURL", "riderImageURL"]);
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "long",
  timeZone: "Africa/Lagos",
});

function humanize(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function EmptyValue({ children }: { children: string }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function OrderValue({ value, field }: { value: unknown; field: string }) {
  if (value === null) return <EmptyValue>---</EmptyValue>;
  if (value === undefined) return <EmptyValue>Not provided</EmptyValue>;
  if (value === "") return <EmptyValue>Empty</EmptyValue>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;

  // Firestore timestamps in nested maps are still Timestamp objects.
  if (
    value instanceof Date ||
    (typeof value === "object" &&
      "toDate" in value &&
      typeof value.toDate === "function")
  ) {
    const date =
      value instanceof Date ? value : (value as { toDate(): Date }).toDate();
    return Number.isNaN(date.getTime()) ? (
      <EmptyValue>Invalid date</EmptyValue>
    ) : (
      <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time>
    );
  }

  if (Array.isArray(value)) {
    if (!value.length) return <EmptyValue>None (empty list)</EmptyValue>;
    return (
      <ol className="space-y-3">
        {value.map((entry, index) => (
          <li key={index} className="min-w-0">
            <OrderValue value={entry} field={field} />
          </li>
        ))}
      </ol>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([key]) => !isHiddenField(key),
    );
    if (!entries.length) return <EmptyValue>Empty map</EmptyValue>;
    return (
      <dl className="space-y-2">
        {entries.map(([key, entry]) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{humanize(key)}</dt>
            <dd className="mt-1">
              <OrderValue value={entry} field={key} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (typeof value === "number") {
    const labels: Record<string, Record<number, string>> = {
      orderStatus: shipmentStatusLabels,
      status: shipmentStatusLabels,
      shipmentType: { 0: "Customs clearance", 1: "Express" },
      clearanceType: { 0: "Sea consignment", 1: "Air consignment" },
      paymentType: { 0: "Wallet", 1: "Cash" },
    };
    if (labels[field]) return <>{labels[field][value] ?? "Unknown"}</>;
    if (moneyFields.has(field))
      return (
        <>₦{value.toLocaleString("en-NG", { maximumFractionDigits: 20 })}</>
      );
    return <>{String(value)}</>;
  }

  const text = String(value);
  if (/^https?:\/\//i.test(text)) {
    return (
      <div className="min-w-0 space-y-2">
        {imageFields.has(field) && (
          <img
            src={text}
            alt={field === "riderImageURL" ? "Assigned rider" : "Shipment item"}
            loading="lazy"
            className="max-h-48 max-w-full rounded-md border object-contain"
          />
        )}
        <a
          href={text}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4 [overflow-wrap:anywhere]"
        >
          {text}
        </a>
      </div>
    );
  }
  return <span className="whitespace-pre-wrap">{text}</span>;
}

export function ShipmentOrderData({ order }: { order: ShipmentOrder }) {
  const data = order as Record<string, unknown>;
  const knownFields = new Set(
    fieldGroups.flatMap((group) => Object.keys(group.fields)),
  );
  const additionalFields = Object.keys(data).filter(
    (key) => !knownFields.has(key) && !isHiddenField(key),
  );
  const groups = [
    ...fieldGroups,
    {
      title: "Additional information",
      fields: Object.fromEntries(
        additionalFields.map((key) => [key, humanize(key)]),
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const fields = Object.entries(group.fields).filter(
          ([key]) =>
            Object.hasOwn(data, key) &&
            !isHiddenField(key) &&
            !(
              key === "ispaid" &&
              order.orderStatus === ShipmentOrderStatus.cancelled
            ),
        );
        if (!fields.length) return null;
        return (
          <Card key={group.title} className="min-w-0 gap-4">
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                {fields.map(([key, label]) => (
                  <div key={key} className="min-w-0 space-y-2">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 text-sm font-medium tabular-nums [overflow-wrap:anywhere]">
                      <OrderValue value={data[key]} field={key} />
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
