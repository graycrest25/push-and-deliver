import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
// app/referrals/[referrerId, pagination.options]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { Search, ArrowLeft } from "lucide-react";
import { referralsService } from "@/services/referrals.service";
import { usersService } from "@/services/users.service";
import type { Referral, User } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToCSV } from "@/lib/csv-export";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, isWithinInterval, format } from "date-fns";

export default function ReferralDetailsPage() {
  const params = useParams();
  // const router = useRouter();
  const referrerId = params.id as string;
  const pagination = useFirestorePagination(referrerId);
  const navigate = useNavigate();

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referrerInfo, setReferrerInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleBack = () => {
    navigate("/referrals");
  };

  useEffect(() => {
    loadData();
  }, [referrerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [referralsData, referrer] = await Promise.all([
        referralsService.getReferralsByReferrerId(referrerId, pagination.options),
        usersService.getUserById(referrerId),
      ]);
      setReferrals(referralsData);
      setReferrerInfo(referrer);
    } catch (error) {
      console.error("Error loading referral details:", error);
      toast.error("Failed to load referral details");
    } finally {
      setLoading(false);
    }
  };

  // Filter referrals
  const filteredReferrals = referrals.filter((ref) => {
    const email = ref.normalizedEmail || "";
    const referredUid = ref.referredUid || "";
    const referrerUid = ref.referrerUid || "";

    const matchesSearch =
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referredUid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referrerUid.toLowerCase().includes(searchTerm.toLowerCase());

    // Date range filter
    let matchesDateRange = true;
    if (dateRange?.from && ref.createdAt) {
      const createdDate =
        ref.createdAt instanceof Date
          ? ref.createdAt
          : ref.createdAt.toDate?.();

      if (createdDate) {
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
    }

    return matchesSearch && matchesDateRange;
  });

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    const dateObj = date instanceof Date ? date : date.toDate?.();
    return dateObj ? format(dateObj, "MMM dd, yyyy hh:mm a") : "N/A";
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Referral Details
          </h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
          <p className="text-muted-foreground">
            {referrerInfo?.username || "Unknown Referrer"} (
            {referrerInfo?.email || referrerId})
          </p>
        </div>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Referred Users</CardTitle>
          <CardDescription>
            All users referred by {referrerInfo?.username || "this user"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search, Date Picker, Export */}
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page: by email or UID..."
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
                const exportData = filteredReferrals.map((ref) => ({
                  email: ref.normalizedEmail || "N/A",
                  referredAt: formatDate(ref.createdAt),
                  referrerUid: ref.referrerUid || "N/A",
                  referredUserUid: ref.referredUid || "N/A",
                  referredUserType: ref.referreduserType || "user",
                  riderType: ref.riderType || "N/A",
                  referralCodeUsed: ref.referralCodeUsed || "N/A",
                }));

                exportToCSV(
                  exportData,
                  [
                    { header: "Email", accessor: "email" },
                    { header: "Referred At", accessor: "referredAt" },
                    { header: "Referrer UID", accessor: "referrerUid" },
                    {
                      header: "Referred User UID",
                      accessor: "referredUserUid",
                    },
                    {
                      header: "Referred User Type",
                      accessor: "referredUserType",
                    },
                    { header: "Rider Type", accessor: "riderType" },
                    {
                      header: "Referral Code Used",
                      accessor: "referralCodeUsed",
                    },
                  ],
                  `referral_details_${referrerId}`,
                );
                toast.success("Referral details exported successfully");
              }}
              disabled={filteredReferrals.length === 0}
            />
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Email</TableHead>
                  <TableHead>Referred At</TableHead>
                  <TableHead>Referrer UID</TableHead>
                  <TableHead>Referred User UID</TableHead>
                  <TableHead>Referred User Type</TableHead>
                  <TableHead>Rider Type</TableHead>
                  <TableHead>Referral Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferrals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No referrals found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReferrals.map((referral, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {referral.normalizedEmail || "N/A"}
                      </TableCell>
                      <TableCell>{formatDate(referral.createdAt)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {referral.referrerUid || "N/A"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {referral.referredUid || "N/A"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {referral.referreduserType || "user"}
                      </TableCell>
                      <TableCell>{referral.riderType || "N/A"}</TableCell>
                      <TableCell>
                        {referral.referralCodeUsed || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table><TablePagination pagination={pagination} loading={loading} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
