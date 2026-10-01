import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Search, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ridersService } from "@/services/riders.service";
import type { Rider } from "@/types";
import { VerificationStatus } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToCSV } from "@/lib/csv-export";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getStatusLabel = (status: string | undefined) => {
  switch (status) {
    case VerificationStatus.verified:
      return "Verified";
    case VerificationStatus.unverified:
      return "Unverified";
    case VerificationStatus.blocked:
      return "Blocked";
    case VerificationStatus.deleted:
      return "Deleted";
    default:
      return "Unverified";
  }
};

const getStatusBadgeVariant = (status: string | undefined) => {
  switch (status) {
    case VerificationStatus.verified:
      return "default" as const;
    case VerificationStatus.blocked:
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
};

export default function RidersPage() {
  const pagination = useFirestorePagination();
  const navigate = useNavigate();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    loadRiders();
  }, [pagination.options]);

  const loadRiders = async () => {
    try {
      setLoading(true);
      const data = await ridersService.getAllRiders(pagination.options);
      setRiders(data);
    } catch (error) {
      console.error("Error loading riders:", error);
      toast.error("Failed to load riders");
    } finally {
      setLoading(false);
    }
  };

  const filteredRiders = riders.filter((r) => {
    const matchesSearch =
      r.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.phonenumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || r.verificationStatus === statusFilter;

    // Date range filter
    let matchesDateRange = true;
    if (dateRange?.from && r.createdAt) {
      const createdDate =
        r.createdAt instanceof Date ? r.createdAt : r.createdAt.toDate(); // Convert Firestore Timestamp to Date

      if (dateRange.to) {
        // Both from and to dates selected
        matchesDateRange = isWithinInterval(createdDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      } else {
        // Only from date selected
        matchesDateRange = isWithinInterval(createdDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.from),
        });
      }
    }

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  const handleVerify = async (id: string) => {
    try {
      setActionLoading(id);
      await ridersService.verifyRider(id);
      toast.success("Rider verified successfully");
      await loadRiders();
    } catch (error) {
      console.error("Error verifying rider:", error);
      toast.error("Failed to verify rider");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (id: string) => {
    try {
      setActionLoading(id);
      await ridersService.blockRider(id);
      toast.success("Rider blocked successfully");
      await loadRiders();
    } catch (error) {
      console.error("Error blocking rider:", error);
      toast.error("Failed to block rider");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      setActionLoading(id);
      await ridersService.unblockRider(id);
      toast.success("Rider unblocked successfully");
      await loadRiders();
    } catch (error) {
      console.error("Error unblocking rider:", error);
      toast.error("Failed to unblock rider");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (
    riderId: string,
    newStatus: VerificationStatus,
  ) => {
    try {
      setActionLoading(riderId);

      if (newStatus === VerificationStatus.verified) {
        await ridersService.verifyRider(riderId);
        toast.success("Rider verified successfully");
      } else if (newStatus === VerificationStatus.blocked) {
        await ridersService.blockRider(riderId);
        toast.success("Rider blocked successfully");
      } else if (newStatus === VerificationStatus.unverified) {
        await ridersService.unblockRider(riderId);
        toast.success("Rider status updated successfully");
      }

      await loadRiders();
    } catch (error) {
      console.error("Error updating rider status:", error);
      toast.error("Failed to update rider status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = (rider: Rider) => {
    if (rider.id) {
      console.log("jdjdj");
      navigate(`/riders/${rider.id}`);
    }
  };

  const totalRiders = riders.length;
  const verifiedRiders = riders.filter(
    (r) => r.verificationStatus === VerificationStatus.verified,
  ).length;
  const blockedRiders = riders.filter(
    (r) => r.verificationStatus === VerificationStatus.blocked,
  ).length;
  const pendingRiders = riders.filter(
    (r) => r.verificationStatus === VerificationStatus.unverified,
  ).length;

  console.log(riders);

  const ridersByVehicle = riders.reduce(
    (acc, rider) => {
      const type: number = rider.vehicleType ?? -1; // Handle undefined
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  // Add these calculations after your existing vehicle breakdown
  const verifiedByVehicle = riders
    .filter((r) => r.verificationStatus === VerificationStatus.verified)
    .reduce(
      (acc, rider) => {
        const type: number = rider.vehicleType ?? -1;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

  const pendingByVehicle = riders
    .filter((r) => r.verificationStatus === VerificationStatus.unverified)
    .reduce(
      (acc, rider) => {
        const type: number = rider.vehicleType ?? -1;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

  const blockedByVehicle = riders
    .filter((r) => r.verificationStatus === VerificationStatus.blocked)
    .reduce(
      (acc, rider) => {
        const type: number = rider.vehicleType ?? -1;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

  const carRiders = ridersByVehicle[0] || 0;
  const bicycleRiders = ridersByVehicle[1] || 0;
  const bikeRiders = ridersByVehicle[2] || 0;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Riders</h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
          <p className="text-muted-foreground">Manage delivery riders</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riders</h1>
        <p className="text-muted-foreground">
          Manage delivery riders, verification, and wallet balances
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-[hsl(220,40%,45%)] bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Riders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "hsl(220, 40%, 45%)" }}
            >
              {totalRiders}
              <div className="flex gap-2">
                <p className="text-xs text-muted-foreground">
                  Cars:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(220, 40%, 45%)" }}
                  >
                    {carRiders}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Bicycles:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(220, 40%, 45%)" }}
                  >
                    {bicycleRiders}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Bikes:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(220, 40%, 45%)" }}
                  >
                    {bikeRiders}
                  </span>
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All registered riders
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(150,35%,42%)] bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "hsl(150, 35%, 42%)" }}
            >
              {verifiedRiders}
            </div>
            <div className="flex gap-2">
              <p className="text-xs text-muted-foreground">
                Cars:{" "}
                <span
                  className="font-bold text-foreground"
                  style={{ color: "hsl(150, 35%, 42%)" }}
                >
                  {verifiedByVehicle[0] || 0}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Bicycles:{" "}
                <span
                  className="font-bold text-foreground"
                  style={{ color: "hsl(150, 35%, 42%)" }}
                >
                  {verifiedByVehicle[1] || 0}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Bikes:{" "}
                <span
                  className="font-bold text-foreground"
                  style={{ color: "hsl(150, 35%, 42%)" }}
                >
                  {verifiedByVehicle[2] || 0}
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active verified riders
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(30,50%,48%)] bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "hsl(30, 50%, 48%)" }}
            >
              {pendingRiders}
              <div className="flex gap-2">
                <p className="text-xs text-muted-foreground">
                  Cars:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(30, 50%, 48%)" }}
                  >
                    {pendingByVehicle[0] || 0}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Bicycles:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(30, 50%, 48%)" }}
                  >
                    {pendingByVehicle[1] || 0}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Bikes:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(30, 50%, 48%)" }}
                  >
                    {pendingByVehicle[2] || 0}
                  </span>
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting verification
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(350,50%,48%)] bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "hsl(350, 50%, 48%)" }}
            >
              {blockedRiders}
              <div className="flex gap-2">
                <p className="text-xs text-muted-foreground">
                  Cars:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(350, 50%, 48%)" }}
                  >
                    {blockedByVehicle[0] || 0}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Bicycles:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(350, 50%, 48%)" }}
                  >
                    {blockedByVehicle[1] || 0}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Bikes:{" "}
                  <span
                    className="font-bold text-foreground"
                    style={{ color: "hsl(350, 50%, 48%)" }}
                  >
                    {blockedByVehicle[2] || 0}
                  </span>
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Blocked riders</p>
          </CardContent>
        </Card>
      </div>

      {/* Riders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rider Details</CardTitle>
          <CardDescription>
            View all riders with verification status and wallet information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search, Filter, and Export */}
          <div className="mb-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page: by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value={VerificationStatus.verified}>
                  Verified
                </SelectItem>
                <SelectItem value={VerificationStatus.unverified}>
                  Pending
                </SelectItem>
                <SelectItem value={VerificationStatus.blocked}>
                  Blocked
                </SelectItem>
              </SelectContent>
            </Select>
            {/* Date Range Picker */}
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {/* Clear Date Filter Button */}
            {dateRange?.from && (
              <Button variant="outline" onClick={() => setDateRange(undefined)}>
                Clear Date
              </Button>
            )}
            <ExportButton
              onClick={() => {
                exportToCSV(
                  filteredRiders,
                  [
                    { header: "Full Name", accessor: "fullname" },
                    { header: "Email", accessor: "email" },
                    { header: "Phone", accessor: "phonenumber" },
                    { header: "Vehicle Type", accessor: "vehicleType" },
                    { header: "Vehicle Make", accessor: "vehicleMakename" },
                    { header: "Plate Number", accessor: "plateNumber" },
                    {
                      header: "Status",
                      accessor: (r: Rider) =>
                        getStatusLabel(r.verificationStatus),
                    },
                    {
                      header: "Online",
                      accessor: (r: Rider) => (r.onlineStatus ? "Yes" : "No"),
                    },
                    { header: "Wallet Balance", accessor: "walletbalance" },
                  ],
                  "riders_export",
                );
                toast.success("Riders exported successfully");
              }}
              disabled={filteredRiders.length === 0}
            />
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRiders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No riders found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRiders.map((rider) => (
                    <TableRow
                      key={rider.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleViewDetails(rider)}
                    >
                      <TableCell className="font-medium">
                        {rider.fullname || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rider.email || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rider.phonenumber || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {rider.vehicleMakename || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(
                            rider.verificationStatus,
                          )}
                        >
                          {getStatusLabel(rider.verificationStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={rider.onlineStatus ? "default" : "outline"}
                        >
                          {rider.onlineStatus ? "Online" : "Offline"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(rider)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table><TablePagination pagination={pagination} loading={loading} /></>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
