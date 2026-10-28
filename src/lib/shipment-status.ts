import { IntlShipmentType, ShipmentOrderStatus, type ShipmentOrder } from "@/types";
import type { AdminShipmentStatus } from "@/services/shipment-orders.service";

export const shipmentStatusLabels: Record<number, string> = {
  [ShipmentOrderStatus.placed]: "Placed",
  [ShipmentOrderStatus.acceptedByRider]: "Accepted by Rider",
  [ShipmentOrderStatus.onRouteToPndHQ]: "On Route to HQ",
  [ShipmentOrderStatus.sentToHq]: "Received at HQ",
  [ShipmentOrderStatus.onrouteToDestination]: "On Route to Destination",
  [ShipmentOrderStatus.deliveredToDestination]: "Delivered to Destination",
  [ShipmentOrderStatus.cancelled]: "Cancelled",
};

export function getShipmentStatusActions(order: ShipmentOrder, allowRiderAssignment = false): { value: AdminShipmentStatus; label: string }[] {
  switch (order.orderStatus) {
    case ShipmentOrderStatus.placed:
      return [
        ...(allowRiderAssignment && !order.riderID && (order.quoteType === "local" || order.shipmentType === IntlShipmentType.express)
          ? [{ value: "AcceptedByRider" as const, label: "Assign rider (development)" }] : []),
        ...(order.quoteType !== "local" && order.shipmentType === IntlShipmentType.customclearance
          ? [{ value: "SentToHq" as const, label: "Confirm HQ receipt" }] : []),
        { value: "Cancelled", label: "Cancel shipment" },
      ];
    case ShipmentOrderStatus.acceptedByRider:
      return [{ value: "Cancelled", label: "Cancel shipment" }];
    case ShipmentOrderStatus.onRouteToPndHQ:
      return [{ value: "SentToHq", label: "Confirm HQ receipt" }];
    case ShipmentOrderStatus.sentToHq:
      return [{ value: "OnrouteToDestination", label: "Confirm onward dispatch" }];
    case ShipmentOrderStatus.onrouteToDestination:
      return order.paylater === true && order.ispaid !== true ? [] : [
        { value: "DeliveredToDestination", label: "Confirm delivery" },
      ];
    default:
      return [];
  }
}
