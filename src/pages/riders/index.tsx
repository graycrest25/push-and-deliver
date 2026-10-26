import { AccountSummaryCards } from "@/components/account-summary-cards";
import { useSearchPagination } from "@/hooks/use-search-pagination";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { formatAccountCreatedAt } from "@/lib/account-date";
("use client");

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
import { ExportButton } from "@/components/ExportButton";
import { exportAdminAccountsCsv } from "@/services/account-export.service";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";

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
  const navigate = useNavigate();
  const [summaryRevision, setSummaryRevision] = useState(0);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const pagination = useSearchPagination(searchTerm, [
    "id",
    "fullname",
    "email",
    "phonenumber",
  ]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    loadRiders();
  }, [pagination.options]);

  const loadRiders = async () => {
    try {
      setLoading(true);
      const data = await ridersService.getAllRiders(pagination.options);
      if (!pagination.options.isCurrent?.()) return;
      setRiders(data);
    } catch (error) {
      if (!pagination.options.isCurrent?.()) return;
      console.error("Error loading riders:", error);
      toast.error("Failed to load riders");
    } finally {
      if (pagination.options.isCurrent?.()) setLoading(false);
    }
  };

  const filteredRiders = riders.filter((r) => {

    const matchesStatus =
      statusFilter === "all" || r.verificationStatus === Number(statusFilter);

    return matchesStatus;
  });

  const handleVerify = async (id: string) => {
    try {
      setActionLoading(id);
      await ridersService.verifyRider(id);
      toast.success("Rider verified successfully");
      pagination.options.searchCache!.result = undefined;
      setSummaryRevision((value) => value + 1);
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
      pagination.options.searchCache!.result = undefined;
      setSummaryRevision((value) => value + 1);
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
      pagination.options.searchCache!.result = undefined;
      setSummaryRevision((value) => value + 1);
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

      pagination.options.searchCache!.result = undefined;
      setSummaryRevision((value) => value + 1);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riders</h1>
        <p className="text-sm text-muted-foreground">
          Search covers all records. Summary cards show all accounts. The date
          range applies only to CSV exports, which include all riders in the
          selected date range. Select a date range to export.
        </p>
        <p className="text-muted-foreground">
          Manage delivery riders, verification, and wallet balances
        </p>
      </div>

      <AccountSummaryCards accountType="riders" revision={summaryRevision} />

      {/* Riders Table */}
      <Card aria-busy={loading}>
        <CardHeader>
          <CardTitle>Rider Details</CardTitle>
          <CardDescription>
            View all riders with verification status and wallet information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <p role="status" className="mb-3 text-sm text-muted-foreground">
              Loading records…
            </p>
          )}
          {/* Search, Filter, and Export */}
          <div className="mb-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search all records: by name, email, or phone..."
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
                <SelectItem value={String(VerificationStatus.verified)}>
                  Verified
                </SelectItem>
                <SelectItem value={String(VerificationStatus.unverified)}>
                  Pending
                </SelectItem>
                <SelectItem value={String(VerificationStatus.blocked)}>
                  Blocked
                </SelectItem>
              </SelectContent>
            </Select>
            {/* Date Range Picker */}
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {/* Clear Export Dates Filter Button */}
            {dateRange?.from && (
              <Button variant="outline" onClick={() => setDateRange(undefined)}>
                Clear Export Dates
              </Button>
            )}
            <ExportButton
              loading={exporting}
              disabled={!dateRange?.from}
              onClick={async () => {
                if (!dateRange?.from || exporting) return;
                setExporting(true);
                try {
                  await exportAdminAccountsCsv(
                    "riders",
                    dateRange.from,
                    dateRange.to ?? dateRange.from,
                  );
                  toast.success("Riders exported successfully");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to export riders.",
                  );
                } finally {
                  setExporting(false);
                }
              }}
            />
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Online</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton columns={["w-32", "w-48", "w-28", "w-20", "w-20", "w-16", "w-44", "w-8"]} />
                  ) : filteredRiders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
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
                        <TableCell className="text-sm text-muted-foreground">
                          {formatAccountCreatedAt(rider.createdAt)}
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
              </Table>
              <TablePagination pagination={pagination} loading={loading} />
            </>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
