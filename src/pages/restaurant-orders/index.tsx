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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { restaurantOrdersService } from "@/services/restaurant-orders.service";
import type { RestaurantOrder } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  IconShoppingCart,
  IconCash,
  IconWallet,
  IconCheck,
  IconX,
  IconSearch,
} from "@tabler/icons-react";

export default function RestaurantOrdersPage() {
  const pagination = useFirestorePagination();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadOrders();
  }, [pagination.options]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await restaurantOrdersService.getAllOrders(pagination.options);
      setOrders(data);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load restaurant orders");
    } finally {
      setLoading(false);
    }
  };

  // Filter orders by customer name
  const filteredOrders = orders.filter((order) =>
    order.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate metrics
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.ispaid).length;
  const unpaidOrders = orders.filter((o) => !o.ispaid).length;
  const totalRevenue = orders
    .filter((o) => o.ispaid)
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const handleRowClick = (orderId: string) => {
    navigate(`/restaurant-orders/${orderId}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Restaurant Orders</h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
        <p className="text-muted-foreground mt-2">
          Manage and track all restaurant orders from customers
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">All time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Orders</CardTitle>
            <IconCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidOrders}</div>
            <p className="text-xs text-muted-foreground">
              {totalOrders > 0
                ? Math.round((paidOrders / totalOrders) * 100)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Orders</CardTitle>
            <IconX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unpaidOrders}</div>
            <p className="text-xs text-muted-foreground">
              {totalOrders > 0
                ? Math.round((unpaidOrders / totalOrders) * 100)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IconWallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From paid orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>
                Click on any order to view full details
              </CardDescription>
            </div>
            <div className="relative w-64">
              <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page: by customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Date Ordered</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
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
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    {searchQuery
                      ? "No orders found matching your search"
                      : "No orders found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(order.id!)}
                  >
                    <TableCell className="font-medium">
                      {order.customer?.name || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.customer?.email || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {order.paymentType === 0 ? (
                          <>
                            <IconWallet className="h-4 w-4" />
                            <span>Wallet</span>
                          </>
                        ) : (
                          <>
                            <IconCash className="h-4 w-4" />
                            <span>Cash</span>
                          </>
                        )}
                      </div>
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
                            "dd-MM-yyyy"
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
