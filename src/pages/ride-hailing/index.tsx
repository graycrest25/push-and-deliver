import { OrderSummaryCards } from "@/components/order-summary-cards";
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
import { rideHailingService } from "@/services/ridehailing.service";
import type { RideHaulingOrder } from "@/types";
import { RideHaulingType, RideHaulingStatus } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { IconSearch, IconFilter } from "@tabler/icons-react";

export default function RideHailingPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<RideHaulingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const pagination = useSearchPagination(searchQuery, ["id"]);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  useEffect(() => {
    loadOrders();
  }, [pagination.options]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await rideHailingService.getAllOrders(pagination.options);
      if (!pagination.options.isCurrent?.()) return;
      setOrders(data);
    } catch (error) {
      if (!pagination.options.isCurrent?.()) return;
      console.error("Error loading orders:", error);
      toast.error("Failed to load ride hailing orders");
    } finally {
      if (pagination.options.isCurrent?.()) setLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "paid" && order.ispaid) ||
      (paymentFilter === "unpaid" && !order.ispaid);

    return matchesPayment;
  });

  const getRideTypeLabel = (type?: number) => {
    switch (type) {
      case RideHaulingType.regular:
        return "Regular";
      case RideHaulingType.discountexpress:
        return "Discount Express";
      case RideHaulingType.express:
        return "Express";
      case RideHaulingType.premier:
        return "Premier";
      case RideHaulingType.courier:
        return "Courier";
      default:
        return "N/A";
    }
  };

  const getStatusLabel = (status?: number) => {
    switch (status) {
      case RideHaulingStatus.requested:
        return "Requested";
      case RideHaulingStatus.accepted:
        return "Accepted";
      case RideHaulingStatus.onroute:
        return "On Route";
      case RideHaulingStatus.completed:
        return "Completed";
      case RideHaulingStatus.cancelled:
        return "Cancelled";
      case RideHaulingStatus.expired:
        return "Expired";
      case RideHaulingStatus.riderArrived:
        return "Rider Arrived";
      default:
        return "Unknown";
    }
  };

  const getStatusVariant = (
    status?: number,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case RideHaulingStatus.completed:
        return "default";
      case RideHaulingStatus.cancelled:
        return "destructive";
      case RideHaulingStatus.expired:
        return "destructive";
      case RideHaulingStatus.requested:
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleRowClick = (orderId: string) => {
    navigate(`/ride-hailing/${orderId}`);
  };


  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Ride Hailing Orders
        </h1>
        <p className="text-sm text-muted-foreground">Search covers all records. Summary cards show all orders; table filters apply to the displayed results.</p>
        <p className="text-muted-foreground mt-2">
          Manage and track all ride hailing requests
        </p>
      </div>

      <OrderSummaryCards orderType="ride-courier" />

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>All Rides</CardTitle>
              <CardDescription>
                Click on any ride to view full details
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative w-64">
                <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all records: by Order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Payment Filter */}
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[150px]">
                  <IconFilter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Ride Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
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
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    {searchQuery || paymentFilter !== "all"
                      ? "No rides found matching your filters"
                      : "No rides found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(order.id!)}
                  >
                    <TableCell className="font-mono text-sm">
                      {order.id?.slice(0, 8) || "N/A"}
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
                    <TableCell>
                      <Badge variant="outline">
                        {getRideTypeLabel(order.rideType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.orderStatus)}>
                        {getStatusLabel(order.orderStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.ispaid ? "default" : "destructive"}>
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
          </Table><TablePagination pagination={pagination} loading={loading} /></>
        </CardContent>
      </Card>
    </div>
  );
}
