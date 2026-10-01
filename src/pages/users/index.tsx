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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp } from "lucide-react";
import { usersService } from "@/services/users.service";
import { referralsService } from "@/services/referrals.service";
import type { User } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToCSV } from "@/lib/csv-export";
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
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
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
const walletChartConfig = {
  high: {
    label: "High (>₦10,000)",
    color: "hsl(150, 35%, 42%)", // forest green
  },
  medium: {
    label: "Medium (₦1,000-10,000)",
    color: "hsl(30, 50%, 48%)", // amber
  },
  low: {
    label: "Low (<₦1,000)",
    color: "hsl(350, 50%, 48%)", // burgundy
  },
} satisfies ChartConfig;

const referralChartConfig = {
  users: {
    label: "Users",
    color: "hsl(220, 40%, 45%)", // navy blue
  },
  referrals: {
    label: "Referrals",
    color: "hsl(270, 35%, 45%)", // deep purple
  },
} satisfies ChartConfig;

const balanceDistributionConfig = {
  balance: {
    label: "Wallet Balance (₦)",
    color: "hsl(185, 40%, 45%)", // teal
  },
} satisfies ChartConfig;

export default function UsersPage() {
  const pagination = useFirestorePagination();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [referralCounts, setReferralCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    loadUsers();
  }, [pagination.options]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await usersService.getAllUsers(pagination.options);
      const entries = await Promise.all(usersData.map(async (user) => [
        user.id!, await referralsService.getReferralCountByReferrerId(user.id!),
      ] as const));
      setUsers(usersData);
      setReferralCounts(new Map(entries));
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user: User) => {
    if (user.id) {
      navigate(`/users/${user.id}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchTerm.toLowerCase());

    // Date range filter
    let matchesDateRange = true;
    if (dateRange?.from && u.createdAt) {
      const createdDate =
        u.createdAt instanceof Date ? u.createdAt : u.createdAt.toDate();

      if (dateRange.to) {
        // Full range selected
        matchesDateRange = isWithinInterval(createdDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      } else {
        // Only from date selected (single day)
        matchesDateRange = isWithinInterval(createdDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.from),
        });
      }
    }

    return matchesSearch && matchesDateRange;
  });

  const totalUsers = users.length;
  const totalReferrals = Array.from(referralCounts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  // Calculate user growth statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const newUsersToday = users.filter((u) => {
    if (!u.createdAt) return false;
    const userDate =
      u.createdAt instanceof Date ? u.createdAt : u.createdAt.toDate();
    return userDate >= today;
  }).length;

  const newUsersThisWeek = users.filter((u) => {
    if (!u.createdAt) return false;
    const userDate =
      u.createdAt instanceof Date ? u.createdAt : u.createdAt.toDate();
    return userDate >= weekAgo;
  }).length;

  const newUsersLastWeek = users.filter((u) => {
    if (!u.createdAt) return false;
    const userDate =
      u.createdAt instanceof Date ? u.createdAt : u.createdAt.toDate();
    const twoWeeksAgo = new Date(weekAgo);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
    return userDate >= twoWeeksAgo && userDate < weekAgo;
  }).length;

  const growthRate =
    newUsersLastWeek > 0
      ? (
          ((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) *
          100
        ).toFixed(1)
      : "0.0";

  // Prepare chart data (still based on all users, not filtered)
  const walletDistributionData = [
    {
      category: "High",
      high: users.filter((u) => (u.walletbalance || 0) > 10000).length,
      fill: "var(--color-high)",
    },
    {
      category: "Medium",
      medium: users.filter(
        (u) =>
          (u.walletbalance || 0) >= 1000 && (u.walletbalance || 0) <= 10000,
      ).length,
      fill: "var(--color-medium)",
    },
    {
      category: "Low",
      low: users.filter((u) => (u.walletbalance || 0) < 1000).length,
      fill: "var(--color-low)",
    },
  ];

  const topUsersByBalance = users
    .sort((a, b) => (b.walletbalance || 0) - (a.walletbalance || 0))
    .slice(0, 10)
    .map((u) => ({
      name: u.username || u.email?.split("@")[0] || "Unknown",
      balance: u.walletbalance || 0,
      fill: "var(--color-balance)",
    }));

  const topUsersByReferrals = Array.from(referralCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, count]) => {
      const user = users.find((u) => u.id === uid);
      return {
        name: user?.username || user?.email?.split("@")[0] || "Unknown",
        users: count,
        referrals: count,
        fill: "var(--color-referrals)",
      };
    });

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
          <p className="text-muted-foreground">
            View user wallets and referral information
          </p>
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
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          View user wallets and referral information
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-[hsl(220,40%,45%)] bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "hsl(220, 40%, 45%)" }}
            >
              {totalUsers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered users
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(150,35%,42%)] bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              New Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "hsl(150, 35%, 42%)" }}
            >
              {newUsersToday}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Users joined today
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(185,40%,45%)] bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              New This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              style={{ color: "hsl(185, 40%, 45%)" }}
            >
              {newUsersThisWeek}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(270,35%,45%)] bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Growth Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold flex items-center gap-2"
              style={{ color: "hsl(270, 35%, 45%)" }}
            >
              {growthRate}%
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Week over week</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wallet Balance Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">
              Users grouped by wallet balance
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={walletChartConfig}>
              <PieChart width={500} height={300}>
                <Pie
                  data={walletDistributionData.filter(
                    (item) =>
                      (item.high || 0 || item.medium || 0 || item.low || 0) > 0,
                  )}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ payload, ...props }) => {
                    const value = payload.high || payload.medium || payload.low;
                    return (
                      <text
                        cx={props.cx}
                        cy={props.cy}
                        x={props.x}
                        y={props.y}
                        textAnchor={props.textAnchor}
                        dominantBaseline={props.dominantBaseline}
                        className="fill-foreground text-xs font-medium"
                      >
                        {`${payload.category}: ${value}`}
                      </text>
                    );
                  }}
                  outerRadius={100}
                  dataKey={(data) => data.high || data.medium || data.low}
                >
                  {walletDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Users by Balance</CardTitle>
            <p className="text-sm text-muted-foreground">
              Highest wallet balances
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={balanceDistributionConfig}>
              <AreaChart data={topUsersByBalance} width={500} height={300}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-balance)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-balance)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--color-balance)"
                  fill="url(#colorBalance)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Referrers Chart */}
      {topUsersByReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Users by Referrals</CardTitle>
            <p className="text-sm text-muted-foreground">
              Most active referrers
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={referralChartConfig}>
              <LineChart data={topUsersByReferrals} width={500} height={300}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="referrals"
                  stroke="var(--color-referrals)"
                  strokeWidth={3}
                  dot={{ r: 6, fill: "var(--color-referrals)" }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
          <CardDescription>
            View all users with their wallet balances and referral counts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search, Date Picker, Export */}
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page: by name, email, or user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <DateRangePicker
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
            )}

            <ExportButton
              onClick={() => {
                exportToCSV(
                  filteredUsers,
                  [
                    { header: "Username", accessor: "username" },
                    { header: "Email", accessor: "email" },
                    { header: "Phone", accessor: "phonenumber" },
                    { header: "Wallet Balance", accessor: "walletbalance" },
                    {
                      header: "Referral Count",
                      accessor: (u: User) => referralCounts.get(u.id!) || 0,
                    },
                    {
                      header: "Created At",
                      accessor: (u: User) =>
                        u.createdAt instanceof Date
                          ? u.createdAt.toISOString().split("T")[0]
                          : "",
                    },
                  ],
                  "users_export",
                );
                toast.success("Users exported successfully");
              }}
              disabled={filteredUsers.length === 0}
            />
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Wallet Balance</TableHead>
                  <TableHead>Referral Count</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleUserClick(user)}
                    >
                      <TableCell className="font-medium">
                        {user.username || "N/A"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {user.id || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.email || "N/A"}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{formatAmount(user.walletbalance || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {referralCounts.get(user.id!) || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.createdAt instanceof Date
                          ? user.createdAt.toLocaleDateString()
                          : "N/A"}
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
