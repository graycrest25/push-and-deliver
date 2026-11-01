import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/contexts/UserContext";
import { ShipmentOrderData } from "@/components/shipment-orders/shipment-order-data";
import { ShipmentFeeForm } from "@/components/shipment-orders/shipment-fee-form";
import { ShipmentStatusControl } from "@/components/shipment-orders/shipment-status-control";
import { shipmentOrdersService } from "@/services/shipment-orders.service";
import {
  IntlShipmentType,
  ShipmentCustomClearanceType,
  ShipmentOrderStatus,
  type ShipmentOrder,
} from "@/types";
import { IconArrowLeft, IconCash, IconWallet } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function ShipmentOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isViewOnly = user?.adminType === "customercare";

  const [order, setOrder] = useState<ShipmentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  useEffect(() => {
    if (!id) return;
    setOrder(null);
    setLoading(true);
    return shipmentOrdersService.subscribeToOrder(
      id,
      (data) => {
        setOrder(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error observing shipment:", error);
        setOrder(null);
        setLoading(false);
        toast.error("Failed to load shipment details");
      },
    );
  }, [id]);

  const loadOrder = async () => {
    const data = await shipmentOrdersService.getOrderById(id!);
    setOrder(data);
  };

  const handlePaymentStatusToggle = async (checked: boolean) => {
    if (
      !order?.id ||
      order.paymentType === 0 ||
      order.orderStatus === ShipmentOrderStatus.cancelled
    )
      return;

    try {
      setUpdatingPayment(true);
      await shipmentOrdersService.updatePaymentStatus(order.id, checked);
      setOrder((current) =>
        current ? { ...current, ispaid: checked } : current,
      );
      toast.success(`Payment status updated to ${checked ? "Paid" : "Unpaid"}`);
    } catch (error) {
      toast.error("Failed to update payment status");
    } finally {
      setUpdatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-muted-foreground">Shipment not found</p>
        <Button onClick={() => navigate("/shipment-orders")}>
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back to Shipments
        </Button>
      </div>
    );
  }

  const isCancelled = order.orderStatus === ShipmentOrderStatus.cancelled;
  const canEditPayment =
    !isCancelled && order.paymentType === 1 && !order.ispaid && !isViewOnly;
  const isLocal = order.quoteType === "local";
  const isCustomClearance =
    !isLocal && order.shipmentType === IntlShipmentType.customclearance;
  const isExpress = !isLocal && order.shipmentType === IntlShipmentType.express;
  const getShipmentTypeLabel = () => {
    if (isLocal) return "Local";
    if (isCustomClearance) {
      if (order.clearanceType === ShipmentCustomClearanceType.seaconsignment) {
        return "Sea Consignment";
      }
      if (order.clearanceType === ShipmentCustomClearanceType.airconsignment) {
        return "Air Consignment";
      }
      return "Custom Clearance";
    }
    if (isExpress) return "Express";
    return "Unknown";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/shipment-orders")}
          aria-label="Back to shipments"
        >
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Shipment Details
          </h1>
          <p className="text-muted-foreground mt-1">
            Shipment ID:{" "}
            <span className="break-all font-mono">{order.shipmentID}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCancelled && (
            <Badge
              variant={order.ispaid ? "default" : "destructive"}
              className="text-sm px-3 py-1"
            >
              {order.ispaid ? "Paid" : "Unpaid"}
            </Badge>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {getShipmentTypeLabel()}
          </Badge>
        </div>
      </div>

      {/* Colored Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="status-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground">
              Order Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ShipmentStatusControl
              key={order.id}
              order={order}
              onRefresh={loadOrder}
            />
          </CardContent>
        </Card>

        <Card className="status-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground">
              Payment Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-secondary-foreground">
              {order.paymentType === 0 ? (
                <>
                  <IconWallet className="h-5 w-5" />
                  <span className="font-semibold">Wallet</span>
                </>
              ) : order.paymentType === 1 ? (
                <>
                  <IconCash className="h-5 w-5" />
                  <span className="font-semibold">Cash</span>
                </>
              ) : (
                <span className="font-semibold">Not specified</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="status-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-secondary-foreground">
              {order.totalAmount == null
                ? "Not provided"
                : `₦${order.totalAmount.toLocaleString("en-NG", { maximumFractionDigits: 20 })}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {isExpress &&
        order.orderStatus !== ShipmentOrderStatus.cancelled &&
        order.orderStatus !== ShipmentOrderStatus.deliveredToDestination &&
        user?.isAdmin === true &&
        (user.adminType === "super" || user.adminType === "regular") && (
          <ShipmentFeeForm key={order.id} order={order} />
        )}

      {canEditPayment && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <Label htmlFor="payment-status" className="text-sm">
              Mark as Paid
            </Label>
            <Switch
              id="payment-status"
              checked={order.ispaid || false}
              onCheckedChange={handlePaymentStatusToggle}
              disabled={updatingPayment}
            />
          </CardContent>
        </Card>
      )}

      <ShipmentOrderData order={order} />
    </div>
  );
}
