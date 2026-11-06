// Mounted native shippingcommands.List encodes these names with ShipmentStatus.
// Keep API values separate from labels shown in filters and tables.
export const shipmentStatuses = {
  placed: "Placed",
  acceptedByRider: "Accepted by rider",
  sentToHq: "Sent to HQ",
  onrouteToDestination: "En route to destination",
  deliveredToDestination: "Delivered to destination",
  cancelled: "Cancelled",
  onRouteToPndHQ: "En route to PND HQ",
} as const;
export function shipmentStatusLabel(value: unknown) {
  if (value === null || value === undefined || value === "") return "Unknown";
  const key =
    typeof value === "number" || /^[0-6]$/.test(String(value))
      ? Object.keys(shipmentStatuses)[Number(value)]
      : String(value);
  return (
    shipmentStatuses[key as keyof typeof shipmentStatuses] ||
    `Unknown (${String(value)})`
  );
}
