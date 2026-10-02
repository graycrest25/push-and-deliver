import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
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

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function RideHailingPage() {
  const pagination = useFirestorePagination();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<RideHaulingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  useEffect(() => {
    loadOrders();
  }, [pagination.options]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await rideHailingService.getAllOrders(pagination.options);
      setOrders(data);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load ride hailing orders");
    } finally {
      setLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.id
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "paid" && order.ispaid) ||
      (paymentFilter === "unpaid" && !order.ispaid);

    return matchesSearch && matchesPayment;
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

  // Calculate metrics
  const totalRides = orders.length;
  const activeRides = orders.filter(
    (o) =>
      o.orderStatus === RideHaulingStatus.requested ||
      o.orderStatus === RideHaulingStatus.accepted ||
      o.orderStatus === RideHaulingStatus.onroute,
  ).length;
  const completedRides = orders.filter(
    (o) => o.orderStatus === RideHaulingStatus.completed,
  ).length;
  const totalRevenue = orders
    .filter((o) => o.ispaid)
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const completedRevenue = orders
    .filter((o) => o.orderStatus === RideHaulingStatus.completed && o.ispaid)
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const canceledRides = orders.filter(
    (o) => o.orderStatus === RideHaulingStatus.cancelled,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Ride Hailing Orders
        </h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
        <p className="text-muted-foreground mt-2">
          Manage and track all ride hailing requests
        </p>
      </div>

      {/* Metrics Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="metric-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Rides
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="text-3xl font-bold"
                style={{ color: "var(--primary)" }}
              >
                {totalRides}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All ride requests
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Rides
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="text-3xl font-bold"
                style={{ color: "var(--warning)" }}
              >
                {activeRides}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently in progress
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed Rides
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="text-3xl font-bold"
                style={{ color: "var(--success)" }}
              >
                {completedRides}
              </div>
              <p className="text-xs text-primary font-bold mt-1">
                ₦{formatAmount(completedRevenue)} earned
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Canceled Rides
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" style={{ color: "#e7000b" }}>
                {canceledRides}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From all rides
              </p>
            </CardContent>
          </Card>
        </div>
      )}

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
                  placeholder="Search this page: by Order ID..."
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
