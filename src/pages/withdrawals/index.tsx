import { getUserTypeLabel, isUserTypeEqual, withdrawalDate, canEditWithdrawal } from "@/lib/withdrawal-utils";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";

import { useState, useEffect } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withdrawalsService } from "@/services/withdrawals.service";
import type { Withdrawal } from "@/types";
import { WithdrawalStatus } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getStatusLabel,
  getStatusBadgeVariant,
  isStatusEqual,
} from "@/lib/status-utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
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

// Professional chart configurations
const statusChartConfig = {
  successful: {
    label: "Successful",
    color: "var(--success)",
  },
  pending: {
    label: "Pending",
    color: "var(--warning)",
  },
  failed: {
    label: "Failed",
    color: "var(--destructive)",
  },
  reversed: {
    label: "Reversed",
    color: "var(--primary)", // navy
  },
} satisfies ChartConfig;

const userTypeChartConfig = {
  vendor: {
    label: "Vendor",
    color: "var(--primary)",
  },
  rider: {
    label: "Rider",
    color: "var(--success)",
  },
  merchant: {
    label: "Ecommerce Merchant",
    color: "var(--warning)",
  },
} satisfies ChartConfig;

export default function WithdrawalsPage() {
  const pagination = useFirestorePagination();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(
    null,
  );
  const [newStatus, setNewStatus] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    loadWithdrawals();
  }, [pagination.options]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const data = await withdrawalsService.getAllWithdrawals(
        pagination.options,
      );
      setWithdrawals(data);
    } catch (error) {
      console.error("Error loading withdrawals:", error);
      toast.error("Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesSearch = !searchTerm ||
      w.accountname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.bankname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.userID?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      w.status === statusFilter ||
      w.status?.toString() === statusFilter ||
      getStatusLabel(w.status) === statusFilter;

    // Date filter
    let matchesDateRange = true;
    if (dateRange?.from) {
      const createdDate = withdrawalDate(w.createdAt);
      matchesDateRange = !!createdDate && isWithinInterval(createdDate, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to ?? dateRange.from),
      });
    }

    return matchesSearch && matchesStatus && matchesDateRange;
  });

  const handleEditClick = (withdrawal: Withdrawal) => {
    if (!canEditWithdrawal(withdrawal.status)) return;
    setEditingWithdrawal(withdrawal);
    setNewStatus(withdrawal.status?.toString() || "1");
  };

  const handleSaveStatus = async () => {
    if (!editingWithdrawal || !canEditWithdrawal(editingWithdrawal.status) || !newStatus) return;

    try {
      setActionLoading(editingWithdrawal.id!);
      const statusValue = Number(newStatus) as WithdrawalStatus;
      await withdrawalsService.updateWithdrawalStatus(
        editingWithdrawal.id!,
        statusValue,
      );
      toast.success(
        `Withdrawal status updated to ${getStatusLabel(statusValue)}`,
      );
      setEditingWithdrawal(null);
      await loadWithdrawals();
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      toast.error("Failed to update withdrawal status");
    } finally {
      setActionLoading(null);
    }
  };

  const totalWithdrawals = withdrawals.length;
  const pendingWithdrawals = withdrawals.filter((w) =>
    isStatusEqual(w.status, 1),
  ).length;
  const successfulWithdrawals = withdrawals.filter((w) =>
    isStatusEqual(w.status, 0),
  ).length;
  const failedWithdrawals = withdrawals.filter((w) =>
    isStatusEqual(w.status, 2),
  ).length;
  const reversedWithdrawals = withdrawals.filter((w) =>
    isStatusEqual(w.status, 3),
  ).length;
  const totalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
  const pendingAmount = withdrawals
    .filter((w) => isStatusEqual(w.status, 1))
    .reduce((sum, w) => sum + (w.amount || 0), 0);
  const successfulAmount = withdrawals
    .filter((w) => isStatusEqual(w.status, 0))
    .reduce((sum, w) => sum + (w.amount || 0), 0);

  // Prepare chart data
  const statusData = [
    {
      status: "Successful",
      successful: successfulWithdrawals,
      fill: "var(--color-successful)",
    },
    {
      status: "Pending",
      pending: pendingWithdrawals,
      fill: "var(--color-pending)",
    },
    {
      status: "Failed",
      failed: failedWithdrawals,
      fill: "var(--color-failed)",
    },
    {
      status: "Reversed",
      reversed: reversedWithdrawals,
      fill: "var(--color-reversed)",
    },
  ];

  const userTypeData = [
    {
      type: "merchant",
      value: withdrawals.filter((w) => isUserTypeEqual(w.userType, 2)).length,
      fill: "var(--color-merchant)",
    },
    {
      type: "vendor",
      value: withdrawals.filter((w) => isUserTypeEqual(w.userType, 0)).length,
      fill: "var(--color-vendor)",
    },
    {
      type: "rider",
      value: withdrawals.filter((w) => isUserTypeEqual(w.userType, 1)).length,
      fill: "var(--color-rider)",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Withdrawals</h1>
          <p className="text-sm text-muted-foreground">
            Search, filters, summaries, and exports apply to the current page.
          </p>
          <p className="text-muted-foreground">Manage withdrawal requests</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">
          Search, filters, summaries, and exports apply to the current page.
        </p>
        <p className="text-muted-foreground">
          Manage withdrawal requests and update their status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="metric-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "var(--primary)" }}
            >
              {totalWithdrawals}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All requests</p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "var(--warning)" }}
            >
              {pendingWithdrawals}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₦{formatAmount(pendingAmount)} pending
            </p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "var(--success)" }}
            >
              {successfulWithdrawals}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₦{formatAmount(successfulAmount)} paid out
            </p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "var(--success)" }}
            >
              ₦{formatAmount(totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Combined value</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
          <CardDescription>
            View and manage all withdrawal requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="mb-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page: by account name, bank, or user ID..."
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
                <SelectItem value="1">Pending</SelectItem>
                <SelectItem value="0">Successful</SelectItem>
                <SelectItem value="2">Failed</SelectItem>
                <SelectItem value="3">Reversed</SelectItem>
              </SelectContent>
            </Select>
            {/* <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              className="w-full sm:w-auto"
            />

            {dateRange?.from && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange(undefined)}
              >
                Clear Date
              </Button>
            )} */}
            <ExportButton
              onClick={() => {
                exportToCSV(
                  filteredWithdrawals,
                  [
                    { header: "Account Name", accessor: "accountname" },
                    { header: "Bank Name", accessor: "bankname" },
                    { header: "Account Number", accessor: "accountnumber" },
                    { header: "Amount", accessor: "amount" },
                    {
                      header: "User Type",
                      accessor: (w) => getUserTypeLabel(w.userType),
                    },
                    {
                      header: "Status",
                      accessor: (w) => getStatusLabel(w.status),
                    },
                    {
                      header: "Date",
                      accessor: (w) =>
                        w.createdAt ? w.createdAt.toString() : "N/A",
                    },
                  ],
                  "withdrawals.csv",
                );
              }}
            />
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <>
              {filteredWithdrawals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Account Name</TableHead>
                      <TableHead>Bank Name</TableHead>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>User Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWithdrawals.map((withdrawal) => (
                      <TableRow
                        key={withdrawal.id}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          {withdrawal.accountname || "N/A"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {withdrawal.bankname || "N/A"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {withdrawal.accountnumber || "N/A"}
                        </TableCell>
                        <TableCell className="font-medium">
                          ₦{formatAmount(withdrawal.amount || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: isUserTypeEqual(
                                withdrawal.userType,
                                0,
                              )
                                ? "hsl(270, 35%, 45%)"
                                : "hsl(185, 40%, 45%)",
                              color: isUserTypeEqual(withdrawal.userType, 0)
                                ? "hsl(270, 35%, 45%)"
                                : "hsl(185, 40%, 45%)",
                            }}
                          >
                            {getUserTypeLabel(withdrawal.userType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(withdrawal.status)}
                          >
                            {getStatusLabel(withdrawal.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canEditWithdrawal(withdrawal.status) && (<Dialog
                            open={editingWithdrawal?.id === withdrawal.id}
                            onOpenChange={(open) =>
                              !open && setEditingWithdrawal(null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(withdrawal)}
                              >
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  Edit Withdrawal Status
                                </DialogTitle>
                                <DialogDescription>
                                  Update the status for withdrawal to{" "}
                                  {withdrawal.accountname || "N/A"} (₦
                                  {formatAmount(withdrawal.amount || 0)})
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="status">Status</Label>
                                  <Select
                                    value={newStatus}
                                    onValueChange={setNewStatus}
                                  >
                                    <SelectTrigger id="status">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0">
                                        Successful
                                      </SelectItem>
                                      <SelectItem value="1">Pending</SelectItem>
                                      <SelectItem value="2">Failed</SelectItem>
                                      <SelectItem value="3">
                                        Reversed
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <p>
                                    <strong>Current Status:</strong>{" "}
                                    <Badge
                                      variant={getStatusBadgeVariant(
                                        withdrawal.status,
                                      )}
                                    >
                                      {getStatusLabel(withdrawal.status)}
                                    </Badge>
                                  </p>
                                  <p className="mt-2">
                                    <strong>Bank:</strong>{" "}
                                    {withdrawal.bankname || "N/A"}
                                  </p>
                                  <p>
                                    <strong>Account:</strong>{" "}
                                    {withdrawal.accountnumber || "N/A"}
                                  </p>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setEditingWithdrawal(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={handleSaveStatus}
                                  disabled={actionLoading === withdrawal.id}
                                >
                                  {actionLoading === withdrawal.id
                                    ? "Updating..."
                                    : "Update Status"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div role="status" className="withdrawals-empty">
                  <h3 className="font-semibold text-foreground">
                    {searchTerm || statusFilter !== "all"
                      ? "No matching withdrawals"
                      : "No withdrawal requests yet"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {searchTerm || statusFilter !== "all"
                      ? "Try a different search or status filter."
                      : "Withdrawal requests will appear here when submitted."}
                  </p>
                  {(searchTerm || statusFilter !== "all") && (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
              <TablePagination pagination={pagination} loading={loading} />
            </>
          </div>
        </CardContent>
      </Card>
      <details className="page-insights">
        <summary>
          <span>Page insights</span>
          <span className="text-sm font-normal text-muted-foreground">
            Charts and rankings from this page
          </span>
        </summary>
        <div className="space-y-4 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Status Distribution</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Breakdown by status
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer config={statusChartConfig}>
                  <BarChart data={statusData} width={500} height={300}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="status"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="successful"
                      fill="var(--color-successful)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="pending"
                      fill="var(--color-pending)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="failed"
                      fill="var(--color-failed)"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="reversed"
                      fill="var(--color-reversed)"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Withdrawals by User Type</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Vendor vs Rider requests
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer config={userTypeChartConfig}>
                  <PieChart width={500} height={300}>
                    <Pie
                      isAnimationActive={false}
                      data={userTypeData.filter((item) => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ payload, ...props }) => {
                        const config =
                          userTypeChartConfig[
                            payload.type as keyof typeof userTypeChartConfig
                          ];
                        return (
                          <text
                            cx={props.cx}
                            cy={props.cy}
                            x={props.x}
                            y={props.y}
                            textAnchor={props.textAnchor}
                            dominantBaseline={props.dominantBaseline}
                            className="fill-foreground text-sm font-medium"
                          >
                            {`${config?.label}: ${payload.value}`}
                          </text>
                        );
                      }}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {userTypeData
                        .filter((item) => item.value > 0)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </details>
    </div>
  );
}
