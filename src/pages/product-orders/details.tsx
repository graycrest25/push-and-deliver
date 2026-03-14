import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/contexts/UserContext";
import { productOrdersService } from "@/services/product-orders.service";
import type { OrderItem, ProductOrder } from "@/types";
import { format } from "date-fns";
import {
  ArrowLeft,
  Bike,
  Calendar,
  Mail,
  MapPin,
  Package,
  Phone,
  Store,
  User,
  Clock,
  CheckCircle,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const OrderStatus = {
  Pending: 0,
  Confirmed: 1,
  Accepted: 2,
  OnRoute: 3,
  Completed: 4,
  Cancelled: 5,
} as const;

export default function ProductOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isViewOnly = user?.adminType === "customercare";

  const [order, setOrder] = useState<ProductOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrderDetails();
    }
  }, [id]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const data = await productOrdersService.getOrderById(id!);
      if (!data) {
        toast.error("Order not found");
        navigate("/product-orders");
        return;
      }
      setOrder(data);
    } catch (error) {
      console.error("Error loading order details:", error);
      toast.error("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentStatusToggle = async (checked: boolean) => {
    if (!order?.id) return;

    try {
      setUpdatingPayment(true);
      await productOrdersService.updatePaymentStatus(order.id, checked);
      setOrder({ ...order, ispaid: checked });
      toast.success(`Payment status updated to ${checked ? "Paid" : "Unpaid"}`);
    } catch (error) {
      toast.error("Failed to update payment status");
    } finally {
      setUpdatingPayment(false);
    }
  };

  const getStatusBadge = (status?: number) => {
    switch (status) {
      case OrderStatus.Pending:
        return (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Pending
          </Badge>
        );
      case OrderStatus.Confirmed:
        return (
          <Badge className="bg-blue-500 text-sm px-3 py-1">Confirmed</Badge>
        );
      case OrderStatus.Accepted:
        return (
          <Badge className="bg-indigo-500 text-sm px-3 py-1">Accepted</Badge>
        );
      case OrderStatus.OnRoute:
        return (
          <Badge className="bg-orange-500 text-sm px-3 py-1">On Route</Badge>
        );
      case OrderStatus.Completed:
        return (
          <Badge className="bg-green-500 text-sm px-3 py-1">Completed</Badge>
        );
      case OrderStatus.Cancelled:
        return (
          <Badge className="bg-red-500 text-sm px-3 py-1">Cancelled</Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-sm px-3 py-1">
            Unknown
          </Badge>
        );
    }
  };

  const getStatusInfo = (status?: number) => {
    switch (status) {
      case OrderStatus.Pending:
        return {
          label: "Pending",
          icon: Clock,
          colorClass:
            "from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800",
          textClass: "text-amber-900 dark:text-amber-100",
          badgeVariant: "secondary" as const,
        };
      case OrderStatus.Confirmed:
        return {
          label: "Confirmed",
          icon: CheckCircle,
          colorClass:
            "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800",
          textClass: "text-blue-900 dark:text-blue-100",
          badgeVariant: "default" as const,
        };
      case OrderStatus.Accepted:
        return {
          label: "Accepted",
          icon: CheckCircle,
          colorClass:
            "from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800",
          textClass: "text-indigo-900 dark:text-indigo-100",
          badgeVariant: "default" as const,
        };
      case OrderStatus.OnRoute:
        return {
          label: "On Route",
          icon: Truck,
          colorClass:
            "from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800",
          textClass: "text-orange-900 dark:text-orange-100",
          badgeVariant: "default" as const,
        };
      case OrderStatus.Completed:
        return {
          label: "Completed",
          icon: CheckCircle,
          colorClass:
            "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800",
          textClass: "text-green-900 dark:text-green-100",
          badgeVariant: "default" as const,
        };
      case OrderStatus.Cancelled:
        return {
          label: "Cancelled",
          icon: AlertTriangle,
          colorClass:
            "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800",
          textClass: "text-red-900 dark:text-red-100",
          badgeVariant: "destructive" as const,
        };
      default:
        return {
          label: "Unknown",
          icon: AlertTriangle,
          colorClass:
            "from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 dark:border-gray-800",
          textClass: "text-gray-900 dark:text-gray-100",
          badgeVariant: "outline" as const,
        };
    }
  };

  const canEditPayment = !order?.ispaid && !isViewOnly;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/product-orders")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">
              Order #{order.orderId || order.id?.substring(0, 8)}
            </h1>
            {getStatusBadge(order.orderstatus)}
            <Badge
              variant={order.ispaid === false ? "destructive" : "default"}
              className="text-sm px-3 py-1"
            >
              {order.ispaid === false ? "Unpaid" : "Paid"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {order.createdAt
              ? format(order.createdAt as Date, "MMMM d, yyyy 'at' h:mm a")
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Order Status Card */}
        {(() => {
          const statusInfo = getStatusInfo(order.orderstatus);
          const StatusIcon = statusInfo.icon;

          return (
            <Card className={`bg-gradient-to-br ${statusInfo.colorClass}`}>
              <CardHeader className="pb-3">
                <CardTitle
                  className={`text-sm font-medium ${statusInfo.textClass}`}
                >
                  Order Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-5 w-5 ${statusInfo.textClass}`} />
                  <Badge
                    variant={statusInfo.badgeVariant}
                    className="text-sm font-semibold"
                  >
                    {statusInfo.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Payment Status Card */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                {order.ispaid ? "Paid" : "Unpaid"}
              </span>
              {canEditPayment && (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="payment-toggle"
                    className="text-xs text-green-800 dark:text-green-200"
                  >
                    Mark as Paid
                  </Label>
                  <Switch
                    id="payment-toggle"
                    checked={order.ispaid || false}
                    onCheckedChange={handlePaymentStatusToggle}
                    disabled={updatingPayment}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Amount Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
              ₦{(order.total || 0).toLocaleString()}
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
              {order.orderItems?.length || 0} items
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items ({order.orderItems?.length || 0})
              </CardTitle>
              <CardDescription>Product details and quantities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.orderItems?.map((item: OrderItem, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="flex gap-4 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-20 w-20 rounded-md object-cover border flex-shrink-0"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Store className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base line-clamp-1">
                        {item.name}
                      </h4>
                      <p className="text-sm text-muted-foreground capitalize mt-0.5">
                        {item.category}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm">
                        {item.selectedColor && (
                          <span className="text-muted-foreground">
                            Color:{" "}
                            <span className="font-medium text-foreground">
                              {item.selectedColor}
                            </span>
                          </span>
                        )}
                        {item.selectedSize && (
                          <span className="text-muted-foreground">
                            Size:{" "}
                            <span className="font-medium text-foreground">
                              {item.selectedSize}
                            </span>
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          Qty:{" "}
                          <span className="font-medium text-foreground">
                            {item.qty}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-muted-foreground">
                        Unit Price
                      </p>
                      <p className="font-medium">
                        ₦{(item.price || 0).toLocaleString()}
                      </p>
                      <Separator className="my-2" />
                      <p className="text-sm text-muted-foreground">Subtotal</p>
                      <p className="text-lg font-bold">
                        ₦{(item.subtotal || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Summary */}
                <Separator className="my-4" />
                <div className="space-y-2 text-right">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-medium">
                      ₦
                      {(
                        (order.total || 0) - (order.deliveryFee || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Fee:</span>
                    <span className="font-medium">
                      ₦{(order.deliveryFee || 0).toLocaleString()}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>₦{(order.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Info Cards */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4" /> Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{order.customerName || "N/A"}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </p>
                <p className="font-medium font-mono text-sm">
                  {order.customerPhoneNumber || "N/A"}
                </p>
              </div>
              {order.customerEmail && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </p>
                    <p className="font-medium text-sm">{order.customerEmail}</p>
                  </div>
                </>
              )}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium">Delivery Address</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {order.deliveryaddress || "N/A"}
                    </p>
                    {order.lga && order.state && (
                      <Badge
                        variant="outline"
                        className="mt-1 text-xs font-normal"
                      >
                        {order.lga}, {order.state}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" /> Vendor Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Merchant</p>
                <p className="font-medium">
                  {order.vendorName || "Unknown Vendor"}
                </p>
              </div>
              {order.vendorAddress && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Address
                    </p>
                    <p className="text-sm leading-relaxed mt-1">
                      {order.vendorAddress}
                    </p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    order.vendorPayoutProcessed ? "default" : "secondary"
                  }
                  className="text-xs"
                >
                  {order.vendorPayoutProcessed
                    ? "Payout Processed"
                    : "Payout Pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Rider Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bike className="h-4 w-4" /> Rider Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.riderid ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{order.ridername || "N/A"}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </p>
                    <p className="font-medium font-mono text-sm">
                      {order.riderphonenumber || "N/A"}
                    </p>
                  </div>
                  {/* <Separator /> */}
                  {/* <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        order.riderPayoutProcessed ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {order.riderPayoutProcessed
                        ? "Payout Processed"
                        : "Payout Pending"}
                    </Badge>
                  </div> */}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg border border-dashed">
                  <Bike className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    No rider assigned yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
