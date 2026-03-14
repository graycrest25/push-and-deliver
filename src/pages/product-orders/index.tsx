import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productOrdersService } from "@/services/product-orders.service";
import type { ProductOrder } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package } from "lucide-react";

const EcomOrderStatus = {
  Pending: 0,
  Confirmed: 1,
  Accepted: 2,
  OnRoute: 3,
  Completed: 4,
  Cancelled: 5,
} as const;

export default function ProductOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTab, setCurrentTab] = useState("all");

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, currentTab]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await productOrdersService.getAllOrders();
      setOrders(data);
      setFilteredOrders(data);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load product orders");
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Filter by Tab (Status)
    if (currentTab !== "all") {
      const statusMap: Record<string, number> = {
        pending: EcomOrderStatus.Pending,
        confirmed: EcomOrderStatus.Confirmed,
        accepted: EcomOrderStatus.Accepted,
        on_route: EcomOrderStatus.OnRoute,
        completed: EcomOrderStatus.Completed,
        cancelled: EcomOrderStatus.Cancelled,
      };

      const targetStatus = statusMap[currentTab];
      if (targetStatus !== undefined) {
        filtered = filtered.filter(
          (order) => order.orderstatus === targetStatus,
        );
      }
    }

    // Filter by Search
    if (searchQuery) {
      const lowercaseQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.orderId?.toLowerCase().includes(lowercaseQuery) ||
          order.customerName?.toLowerCase().includes(lowercaseQuery) ||
          order.customerPhoneNumber?.includes(searchQuery),
      );
    }

    setFilteredOrders(filtered);
  };

  const getStatusBadge = (status?: number) => {
    switch (status) {
      case EcomOrderStatus.Pending:
        return (
          <Badge variant="secondary" className="font-medium">
            Pending
          </Badge>
        );
      case EcomOrderStatus.Confirmed:
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 font-medium">
            Confirmed
          </Badge>
        );
      case EcomOrderStatus.Accepted:
        return (
          <Badge className="bg-indigo-500 hover:bg-indigo-600 font-medium">
            Accepted
          </Badge>
        );
      case EcomOrderStatus.OnRoute:
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 font-medium">
            On Route
          </Badge>
        );
      case EcomOrderStatus.Completed:
        return (
          <Badge className="bg-green-500 hover:bg-green-600 font-medium">
            Completed
          </Badge>
        );
      case EcomOrderStatus.Cancelled:
        return (
          <Badge className="bg-red-500 hover:bg-red-600 font-medium">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-medium">
            Unknown
          </Badge>
        );
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/product-orders/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Orders</h1>
          <p className="text-muted-foreground">
            View and manage unpaid orders from E-commerce Merchants
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Order ID, Customer Name..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs
        defaultValue="all"
        onValueChange={setCurrentTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="on_route">On Route</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={currentTab} className="space-y-4">
          <Card>
            <CardHeader className="p-0" />
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    No orders found
                  </h3>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "Try adjusting your search criteria"
                      : "Product orders will appear here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">
                          Order ID
                        </TableHead>
                        <TableHead className="font-semibold">
                          Customer
                        </TableHead>
                        <TableHead className="font-semibold">Items</TableHead>
                        <TableHead className="font-semibold">
                          Total Amount
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Address</TableHead>
                        <TableHead className="font-semibold">
                          Created At
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/70 transition-colors group"
                          onClick={() => handleRowClick(order.id!)}
                        >
                          <TableCell className="font-mono font-medium text-sm">
                            {order.orderId || order.id?.substring(0, 8)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {order.customerName || "N/A"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {order.customerPhoneNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {order.orderItems?.length || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₦{(order.total || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(order.orderstatus)}
                          </TableCell>
                          <TableCell
                            className="max-w-[250px]"
                            title={order.deliveryaddress}
                          >
                            <div className="truncate text-sm text-muted-foreground">
                              {order.deliveryaddress || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.createdAt
                              ? format(order.createdAt as Date, "MMM d, yyyy")
                              : "N/A"}
                            <div className="text-xs text-muted-foreground">
                              {order.createdAt
                                ? format(order.createdAt as Date, "h:mm a")
                                : ""}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
