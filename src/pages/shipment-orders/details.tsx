import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/contexts/UserContext";
import { ShipmentFeeForm } from "@/components/shipment-orders/shipment-fee-form";
import { ShipmentStatusControl } from "@/components/shipment-orders/shipment-status-control";
import { shipmentOrdersService } from "@/services/shipment-orders.service";
import {
  IntlShipmentType,
  ShipmentCustomClearanceType,
  ShipmentOrderStatus,
  type ShipmentOrder,
} from "@/types";
import { Separator } from "@radix-ui/react-separator";
import {
  IconArrowLeft,
  IconBuilding,
  IconCash,
  IconExternalLink,
  IconFileTypePdf,
  IconMapPin,
  IconPackage,
  IconRuler,
  IconScale,
  IconTruck,
  IconUser,
  IconWallet,
} from "@tabler/icons-react";
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
    return shipmentOrdersService.subscribeToOrder(id, (data) => {
      setOrder(data);
      setLoading(false);
    }, (error) => {
      console.error("Error observing shipment:", error);
      setOrder(null);
      setLoading(false);
      toast.error("Failed to load shipment details");
    });
  }, [id]);

  const loadOrder = async () => {
    const data = await shipmentOrdersService.getOrderById(id!);
    setOrder(data);
  };

  const handlePaymentStatusToggle = async (checked: boolean) => {
    if (!order?.id || order.paymentType === 0) return;

    try {
      setUpdatingPayment(true);
      await shipmentOrdersService.updatePaymentStatus(order.id, checked);
      setOrder((current) => current ? { ...current, ispaid: checked } : current);
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

  const canEditPayment =
    order.paymentType === 1 && !order.ispaid && !isViewOnly;
  const isLocal = order.quoteType === "local";
  const isCustomClearance =
    !isLocal && order.shipmentType === IntlShipmentType.customclearance;
  const isExpress = !isLocal && order.shipmentType === IntlShipmentType.express;
  const hasRider = !!order.riderID;

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
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/shipment-orders")}
        >
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Shipment Details
          </h1>
          <p className="text-muted-foreground mt-1">
            Shipment ID: <span className="font-mono">{order.shipmentID}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={order.ispaid ? "default" : "destructive"}
            className="text-sm px-3 py-1"
          >
            {order.ispaid ? "Paid" : "Unpaid"}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {getShipmentTypeLabel()}
          </Badge>
        </div>
      </div>

      {(order.localtype || order.localzone) && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {order.localtype && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Local type</dt>
              <dd className="font-medium">{order.localtype}</dd>
            </div>
          )}
          {order.localzone && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Local zone</dt>
              <dd className="font-medium">{order.localzone}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Colored Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="status-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground">
              Order Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ShipmentStatusControl key={order.id} order={order} onRefresh={loadOrder} />
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
              ) : (
                <>
                  <IconCash className="h-5 w-5" />
                  <span className="font-semibold">Cash</span>
                </>
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
              ₦{(order.totalAmount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {isExpress && order.orderStatus !== ShipmentOrderStatus.cancelled && order.orderStatus !== ShipmentOrderStatus.deliveredToDestination && user?.isAdmin === true && (user.adminType === "super" || user.adminType === "regular") && (
        <ShipmentFeeForm key={order.id} order={order} />
      )}

      {/* Customer & Receiver Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUser className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium">
                  {order.customerName || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Phone</span>
                <span className="text-sm font-medium">
                  {order.customerPhonenumber || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium">
                  {order.senderemailaddress || "N/A"}
                </span>
              </div>
            </div>

            {canEditPayment && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="payment-status" className="text-sm">
                    Mark as Paid
                  </Label>
                  <Switch
                    id="payment-status"
                    checked={order.ispaid || false}
                    onCheckedChange={handlePaymentStatusToggle}
                    disabled={updatingPayment}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUser className="h-5 w-5" />
              Receiver Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">
                {order.receivername || "Not provided"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Phone</span>
              <span className="text-sm font-medium">
                {order.receiverphonenumber || "Not provided"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">
                {order.receiveremail || "Not provided"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clearance Document (for Custom Clearance) */}
      {isCustomClearance &&
        order.clearancedocument &&
        (() => {
          // Helper function to check if URL is a PDF
          const isPDF = (url: string) => {
            return (
              url.toLowerCase().includes(".pdf") ||
              url.toLowerCase().includes("pdf?")
            );
          };

          const documentIsPDF = isPDF(order.clearancedocument);

          return (
            <Card>
              <CardHeader>
                <CardTitle>Clearance Document</CardTitle>
                <CardDescription>
                  {order.clearanceType ===
                  ShipmentCustomClearanceType.seaconsignment
                    ? "Sea Consignment Documentation"
                    : "Air Consignment Documentation"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentIsPDF ? (
                  // PDF Display - View only
                  <a
                    href={order.clearancedocument}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer group">
                      <div className="flex-shrink-0">
                        <IconFileTypePdf className="h-16 w-16 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          Clearance Document (PDF)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click to view document in new tab
                        </p>
                      </div>
                      <IconExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </a>
                ) : (
                  // Image Display - Inline preview
                  <img
                    src={order.clearancedocument}
                    alt="Clearance Document"
                    className="rounded-lg max-w-full max-h-[500px] w-auto object-contain border"
                  />
                )}
              </CardContent>
            </Card>
          );
        })()}

      {/* Optional Documents (Packing List & Invoice) - View Only */}
      {isCustomClearance && (order.packingListUrl || order.invoiceUrl) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Packing List - View Only */}
          {order.packingListUrl &&
            (() => {
              const isPDF =
                order.packingListUrl.toLowerCase().includes(".pdf") ||
                order.packingListUrl.toLowerCase().includes("pdf?");

              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Packing List</CardTitle>
                    <CardDescription>
                      View the packing list document for this shipment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={order.packingListUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="flex items-center gap-4 p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer group">
                        <div className="flex-shrink-0">
                          {isPDF ? (
                            <IconFileTypePdf className="h-16 w-16 text-red-500" />
                          ) : (
                            <IconFileTypePdf className="h-16 w-16 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            Packing List ({isPDF ? "PDF" : "Image"})
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Click to view document in new tab
                          </p>
                        </div>
                        <IconExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </a>
                  </CardContent>
                </Card>
              );
            })()}

          {/* Invoice - View Only */}
          {order.invoiceUrl &&
            (() => {
              const isPDF =
                order.invoiceUrl.toLowerCase().includes(".pdf") ||
                order.invoiceUrl.toLowerCase().includes("pdf?");

              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice</CardTitle>
                    <CardDescription>
                      View the invoice document for this shipment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={order.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="flex items-center gap-4 p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer group">
                        <div className="flex-shrink-0">
                          {isPDF ? (
                            <IconFileTypePdf className="h-16 w-16 text-red-500" />
                          ) : (
                            <IconFileTypePdf className="h-16 w-16 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            Invoice ({isPDF ? "PDF" : "Image"})
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Click to view document in new tab
                          </p>
                        </div>
                        <IconExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </a>
                  </CardContent>
                </Card>
              );
            })()}
        </div>
      )}

      {/* Locations */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconMapPin className="h-4 w-4" />
              Pickup Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {order.startoffAddress || "No address provided"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconBuilding className="h-4 w-4" />
              PnD Office
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {order.pndofficeaddress || "No address provided"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconMapPin className="h-4 w-4" />
              Drop-off Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {order.dropoffAddress || "No address provided"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Item Details (for Express) */}
      {isExpress && (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconPackage className="h-5 w-5" />
              Item Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 space-y-2">
                <dt className="text-sm text-muted-foreground">Item Type</dt>
                <dd className="flex flex-wrap gap-2">
                  {order.itemType ? (
                    Array.isArray(order.itemType) ? (
                      order.itemType.map((type, idx) => (
                        <Badge key={idx} variant="secondary" className="max-w-full whitespace-normal break-words text-left">
                          {type}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary" className="max-w-full whitespace-normal break-words text-left">
                        {order.itemType}
                      </Badge>
                    )
                  ) : (
                    <span className="text-sm font-medium">Not specified</span>
                  )}
                </dd>
              </div>
              <div className="min-w-0 space-y-2">
                <dt className="text-sm text-muted-foreground">Item Value</dt>
                <dd className="break-words text-sm font-medium tabular-nums">
                  ₦{(order.itemvalue || 0).toLocaleString()}
                </dd>
              </div>
              <div className="min-w-0 space-y-2">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconScale aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Weight
                </dt>
                <dd className="break-words text-sm font-medium tabular-nums">
                  {order.weightinKG || 0} KG
                </dd>
              </div>
              <div className="min-w-0 space-y-2">
                <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconRuler aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Dimensions
                </dt>
                <dd className="break-words text-sm font-medium tabular-nums">
                  {order.widthinCM || 0}W × {order.heightinCM || 0}H ×{" "}
                  {order.breadthinCM || 0}B cm
                </dd>
              </div>
            </dl>
            {/* Item Image */}
            {order.itemImage && (
              <div className="pt-4 border-t">
                <span className="text-sm text-muted-foreground block mb-2">
                  Item Image
                </span>
                <img
                  src={order.itemImage}
                  alt="Item"
                  className="rounded-lg max-w-full max-h-[300px] w-auto object-contain border"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rider Information */}
      {hasRider && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTruck className="h-5 w-5" />
              Rider Information
            </CardTitle>
            <CardDescription>Assigned delivery rider details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Rider Profile Section */}
              <div className="flex flex-col items-center gap-3 md:border-r md:pr-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={order.riderImageURL} />
                  <AvatarFallback className="text-2xl">
                    {order.riderName?.charAt(0) || "R"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="font-semibold text-lg">
                    {order.riderName || "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.riderPhoneNumber || "N/A"}
                  </p>
                </div>
              </div>

              {/* Vehicle Details Section */}
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Vehicle Details
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Model</span>
                    <span className="text-sm font-medium">
                      {order.riderCarModel || "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Plate Number
                    </span>
                    <Badge variant="outline" className="w-fit font-mono">
                      {order.riderCarPlateNumber || "N/A"}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Color</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full border border-gray-300"
                        style={{
                          backgroundColor:
                            order.riderCarColor?.toLowerCase() || "#gray",
                        }}
                      />
                      <span className="text-sm font-medium">
                        {order.riderCarColor || "N/A"}
                      </span>
                    </div>
                  </div>
                  {order.riderCarName && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        Car Name
                      </span>
                      <span className="text-sm font-medium">
                        {order.riderCarName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasRider && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
            <p>No rider assigned yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
