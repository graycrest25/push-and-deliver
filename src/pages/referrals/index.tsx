import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
"use client";

import { useState, useEffect } from "react";
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
import { Search } from "lucide-react";
import { referralsService } from "@/services/referrals.service";
import { usersService } from "@/services/users.service";
import type { Referral, User } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToCSV } from "@/lib/csv-export";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function ReferralsPage() {
  const pagination = useFirestorePagination();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [pagination.options]);

  const loadData = async () => {
    try {
      setLoading(true);
      const referralsData = await referralsService.getAllReferrals(pagination.options);
      const ids = [...new Set(referralsData.map((ref) => ref.referrerUid).filter(Boolean))];
      const usersData = await Promise.all(ids.map((id) => usersService.getUserById(id!)));
      setReferrals(referralsData);
      const usersMap = new Map<string, User>();
      usersData.forEach((user) => { if (user?.id) usersMap.set(user.id, user); });
      setUsers(usersMap);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load referrals. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  // Group referrals by referrer
  const referrerStats = referrals.reduce(
    (acc, ref) => {
      const referrerId = ref.referrerUid;
      if (!referrerId) return acc;

      if (!acc[referrerId]) {
        const referrerUser = users.get(referrerId);
        acc[referrerId] = {
          referrerId,
          referrerName: referrerUser?.username || "Unknown",
          referralCount: 0,
          referredUsers: [],
          referredUserTypes: [],
          createdAt: referrerUser?.createdAt, // ← Add for date filtering
        };
      }

      acc[referrerId].referralCount++;
      if (ref.referredUid) {
        acc[referrerId].referredUsers.push(ref.referredUid);
      }
      if (ref.referreduserType) {
        acc[referrerId].referredUserTypes.push(ref.referreduserType);
      }

      return acc;
    },
    {} as Record<
      string,
      {
        referrerId: string;
        referrerName: string;
        referralCount: number;
        referredUsers: string[];
        referredUserTypes: string[];
        createdAt?: Date | any; // Firestore Timestamp or Date
      }
    >,
  );

  const referrerList = Object.values(referrerStats);

  const filteredReferrers = referrerList.filter((r) => {
    const matchesSearch =
      r.referrerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referrerId.toLowerCase().includes(searchTerm.toLowerCase());

    // Date range filter on referrer's createdAt
    let createdDate: Date | undefined;
    if (r.createdAt) {
      if (r.createdAt instanceof Date) {
        createdDate = r.createdAt;
      } else if (typeof r.createdAt.toDate === "function") {
        createdDate = r.createdAt.toDate();
      }
    }
    let matchesDateRange = true;
    if (dateRange?.from && createdDate) {
      const createdDate =
        r.createdAt instanceof Date ? r.createdAt : r.createdAt.toDate?.();

      if (dateRange.to) {
        matchesDateRange = isWithinInterval(createdDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      } else {
        matchesDateRange = isWithinInterval(createdDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.from),
        });
      }
    }

    return matchesSearch && matchesDateRange;
  });

  const totalReferrers = referrerList.length;
  const totalReferralCount = referrals.length;
  const avgReferrals =
    totalReferrers > 0 ? (totalReferralCount / totalReferrers).toFixed(1) : "0";

  const handleRowClick = (referralId: string) => {
    navigate(`/referrals/${referralId}`);
  };
  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
          <p className="text-muted-foreground">Track user referrals</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
        <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground">
          Track user referrals and referral activity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Referrers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferrers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReferralCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Referrals per User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgReferrals}</div>
          </CardContent>
        </Card>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Details</CardTitle>
          <CardDescription>
            View all referrers and their referred users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search, Date Picker, Export */}
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page: by name or user ID..."
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
                const exportData = filteredReferrers.map((r) => {
                  const userCount =
                    r.referredUserTypes.filter((type) => type === "user")
                      .length +
                    (r.referralCount - r.referredUserTypes.length);

                  const riderCount = r.referredUserTypes.filter(
                    (type) => type === "rider",
                  ).length;

                  return {
                    referrerName: r.referrerName,
                    referrerId: r.referrerId,
                    userCount,
                    riderCount,
                    totalReferralCount: r.referralCount,
                    status: r.referralCount > 5 ? "Top Referrer" : "Active",
                  };
                });

                exportToCSV(
                  exportData,
                  [
                    { header: "Referrer Name", accessor: "referrerName" },
                    { header: "Referrer UID", accessor: "referrerId" },
                    { header: "User", accessor: "userCount" },
                    { header: "Rider", accessor: "riderCount" },
                    {
                      header: "Total Referrals",
                      accessor: "totalReferralCount",
                    },
                    { header: "Status", accessor: "status" },
                  ],
                  "referrals_export",
                );
                toast.success("Referrals exported successfully");
              }}
              disabled={filteredReferrers.length === 0}
            />
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Referrer Name</TableHead>
                  <TableHead>Referrer UID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead>Total Referrer Count</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No referrers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReferrers.map((referrer) => (
                    <TableRow
                      key={referrer.referrerId}
                      className="hover:bg-muted/50"
                      onClick={() => handleRowClick(`${referrer.referrerId}`)}
                    >
                      <TableCell className="font-medium">
                        {referrer.referrerName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {referrer.referrerId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(() => {
                            const userCount = referrer.referredUserTypes.filter(
                              (type) => type === "user",
                            ).length;
                            const unspecifiedCount =
                              referrer.referralCount -
                              referrer.referredUserTypes.length;
                            return userCount + unspecifiedCount;
                          })()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {
                            referrer.referredUserTypes.filter(
                              (type) => type === "rider",
                            ).length
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {referrer.referralCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {referrer.referralCount > 5
                            ? "Top Referrer"
                            : "Active"}
                        </Badge>
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
