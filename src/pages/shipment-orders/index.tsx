import { OrderSummaryCards } from "@/components/order-summary-cards";
import { useCurrentUser } from "@/contexts/UserContext";
import { useHeadOffices } from "@/hooks/use-head-offices";
import { Button } from "@/components/ui/button";
import { useSearchPagination } from "@/hooks/use-search-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { shipmentOrdersService } from "@/services/shipment-orders.service";
import type { ShipmentOrder } from "@/types";
import {
  IntlShipmentType,
  ShipmentCustomClearanceType,
  ShipmentOrderStatus,
} from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { IconPackage, IconSearch, IconFilter } from "@tabler/icons-react";

export default function ShipmentOrdersPage() {
  const { adminType } = useCurrentUser();
  const isSuperAdmin = adminType === "super";
  const [headOfficeFilter, setHeadOfficeFilter] = useState("all");
  const headOfficeId =
    isSuperAdmin && headOfficeFilter !== "all" ? headOfficeFilter : undefined;
  const {
    offices,
    loading: loadingOffices,
    error: officeError,
    reload: reloadOffices,
  } = useHeadOffices();
  const officeMap = new Map(offices.map((office) => [office.id, office]));
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderError, setOrderError] = useState("");
  const [reloadOrders, setReloadOrders] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const pagination = useSearchPagination(searchQuery, ["id", "shipmentID"], headOfficeId ?? "");
  const [shipmentTypeFilter, setShipmentTypeFilter] = useState<string>("all");
  const [clearanceTypeFilter, setClearanceTypeFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOrders([]);
    setOrderError("");
    shipmentOrdersService
      .getAllOrders(pagination.options, headOfficeId)
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((error: unknown) => {
        if (active) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to load shipment orders";
          setOrderError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pagination.options, headOfficeId, reloadOrders]);

  const officeOptions = new Map(
    offices.map((office) => [
      office.id,
      `${office.location || "Unnamed office"}${office.active ? "" : " (inactive)"} · ${office.id}`,
    ]),
  );
  // Historical shipments retain their document ID after an office is deleted.
  for (const order of orders) {
    const id = order.pndofficelocationID;
    if (id && !officeOptions.has(id))
      officeOptions.set(id, `Unavailable office · ${id}`);
  }
  if (headOfficeId && !officeOptions.has(headOfficeId))
    officeOptions.set(headOfficeId, `Unavailable office · ${headOfficeId}`);

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesShipmentType =
      shipmentTypeFilter === "all" ||
      (order.quoteType === "local"
        ? shipmentTypeFilter === "local"
        : order.shipmentType?.toString() === shipmentTypeFilter);
    const matchesClearanceType =
      clearanceTypeFilter === "all" ||
      (order.quoteType !== "local" &&
        order.shipmentType === IntlShipmentType.customclearance &&
        order.clearanceType?.toString() === clearanceTypeFilter);

    return matchesShipmentType && matchesClearanceType;
  });

  const getShipmentTypeLabel = (type?: number) => {
    if (type === IntlShipmentType.customclearance) return "Custom Clearance";
    if (type === IntlShipmentType.express) return "Express";
    return "N/A";
  };

  const getClearanceTypeLabel = (type?: number) => {
    if (type === ShipmentCustomClearanceType.seaconsignment)
      return "Sea Consignment";
    if (type === ShipmentCustomClearanceType.airconsignment)
      return "Air Consignment";
    return "N/A";
  };

  const getStatusLabel = (status?: number) => {
    switch (status) {
      case ShipmentOrderStatus.placed:
        return "Placed";
      case ShipmentOrderStatus.acceptedByRider:
        return "Accepted by Rider";
      case ShipmentOrderStatus.sentToHq:
        return "Sent to HQ";
      case ShipmentOrderStatus.onrouteToDestination:
        return "On Route to Destination";
      case ShipmentOrderStatus.deliveredToDestination:
        return "Delivered";
      case ShipmentOrderStatus.cancelled:
        return "Cancelled";
      case ShipmentOrderStatus.onRouteToPndHQ:
        return "On Route to PnD HQ";
      default:
        return "Unknown";
    }
  };

  const getStatusVariant = (
    status?: number,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case ShipmentOrderStatus.deliveredToDestination:
        return "default";
      case ShipmentOrderStatus.cancelled:
        return "destructive";
      case ShipmentOrderStatus.placed:
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleRowClick = (orderId: string) => {
    navigate(`/shipment-orders/${orderId}`);
  };


  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shipment Orders</h1>
        <p className="text-sm text-muted-foreground">
          Search covers all shipments in the selected office. Summary cards show all shipments across every office. Shipment type filters apply to the displayed results.{" "}
          {isSuperAdmin &&
            "Head office filters all shipments before pagination."}
        </p>
        <p className="text-muted-foreground mt-2">
          Manage and track all shipment orders
        </p>
      </div>

      <OrderSummaryCards orderType="shipment" />

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>All Shipments</CardTitle>
              <CardDescription>
                Click on any shipment to view full details
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative w-64">
                <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all records: by Shipment ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {isSuperAdmin && (
                <Select
                  value={headOfficeId ?? "all"}
                  onValueChange={setHeadOfficeFilter}
                  disabled={loadingOffices}
                >
                  <SelectTrigger
                    aria-label="Filter shipments by head office"
                    className="w-full sm:w-[260px]"
                  >
                    <SelectValue placeholder="All head offices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All head offices</SelectItem>
                    {[...officeOptions].map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Shipment Type Filter */}
              <Select
                value={shipmentTypeFilter}
                onValueChange={(value) => {
                  setShipmentTypeFilter(value);
                  if (value !== "0") {
                    setClearanceTypeFilter("all");
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <IconFilter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Shipment Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="0">Custom Clearance</SelectItem>
                  <SelectItem value="1">Express</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                </SelectContent>
              </Select>

              {/* Clearance Type Filter (only for custom clearance) */}
              {shipmentTypeFilter === "0" && (
                <Select
                  value={clearanceTypeFilter}
                  onValueChange={setClearanceTypeFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <IconPackage className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Clearance Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clearance</SelectItem>
                    <SelectItem value="0">Sea Consignment</SelectItem>
                    <SelectItem value="1">Air Consignment</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isSuperAdmin && officeError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center gap-2 text-sm text-destructive"
            >
              Unable to load head office names: {officeError}
              <Button variant="outline" size="sm" onClick={reloadOffices}>
                Retry offices
              </Button>
            </div>
          )}
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment ID</TableHead>
                  <TableHead>Customer</TableHead>
                  {isSuperAdmin && <TableHead>Head office</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : orderError ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 8 : 7} className="py-8">
                      <div role="alert" className="space-y-3 text-center">
                        <p className="break-words text-sm text-destructive">
                          Unable to load shipments: {orderError}
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => setReloadOrders((value) => value + 1)}
                        >
                          Retry shipments
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isSuperAdmin ? 8 : 7}
                      className="text-center text-muted-foreground py-8"
                    >
                      {searchQuery ||
                      shipmentTypeFilter !== "all" ||
                      clearanceTypeFilter !== "all" ||
                      headOfficeId
                        ? "No shipments found matching your filters"
                        : "No shipments found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(order.id!)}
                    >
                      <TableCell className="font-mono font-medium">
                        {order.shipmentID || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {order.customerName || "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.customerPhonenumber}
                          </p>
                        </div>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="max-w-56">
                          <p
                            className="truncate text-sm"
                            title={
                              officeMap.get(order.pndofficelocationID || "")
                                ?.location
                            }
                          >
                            {order.pndofficelocationID
                              ? officeMap.get(order.pndofficelocationID)
                                  ?.location || "Unavailable office"
                              : "Not assigned"}
                          </p>
                          {order.pndofficelocationID && (
                            <p
                              className="mt-1 truncate font-mono text-xs text-muted-foreground"
                              title={order.pndofficelocationID}
                            >
                              {order.pndofficelocationID}
                            </p>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {order.quoteType === "local"
                              ? "Local"
                              : getShipmentTypeLabel(order.shipmentType)}
                          </p>
                          {order.quoteType !== "local" && order.shipmentType ===
                            IntlShipmentType.customclearance && (
                            <p className="text-xs text-muted-foreground">
                              {getClearanceTypeLabel(order.clearanceType)}
                            </p>
                          )}
                          {order.localtype && (
                            <p className="text-xs text-muted-foreground">
                              Local type: {order.localtype}
                            </p>
                          )}
                          {order.localzone && (
                            <p className="text-xs text-muted-foreground">
                              Local zone: {order.localzone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(order.orderStatus)}>
                          {getStatusLabel(order.orderStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={order.ispaid ? "default" : "destructive"}
                        >
                          {order.ispaid ? "Paid" : "Unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.createdAt
                          ? format(
                              new Date(order.createdAt as Date),
                              "dd-MM-yyyy",
                            )
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₦{(order.totalAmount || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination pagination={pagination} loading={loading} />
          </>
        </CardContent>
      </Card>
    </div>
  );
}
