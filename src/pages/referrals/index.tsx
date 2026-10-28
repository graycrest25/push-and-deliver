import { useTableState } from "@/contexts/TableStateContext";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { ReferralSummaryCards } from "@/components/referral-summary-cards";
import { useReferralList } from "@/hooks/use-referral-list";
import {
  adminReferralsService,
  REFERRAL_LIMITS,
  type ReferralLimit,
} from "@/services/admin-referrals.service";
import { toast } from "sonner";

const createdDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(new Date(value))
    : "Not recorded";

export default function ReferralsPage() {
  const [referredUid, setReferredUid] = useTableState("table:referredUid", "");
  const [referralCodeUsed, setReferralCodeUsed] = useTableState("table:referralCodeUsed", "");
  const [referreduserType, setReferreduserType] = useTableState("table:referreduserType", "all");
  const [search, setSearch] = useTableState("table:search", {
    referredUid: "",
    referralCodeUsed: "",
  });
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setSearch({
          referredUid: referredUid.trim(),
          referralCodeUsed: referralCodeUsed.trim(),
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [referredUid, referralCodeUsed]);
  const list = useReferralList({
    ...search,
    referreduserType: referreduserType === "all" ? undefined : referreduserType,
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [list.requestKey]);
  const exportCsv = async () => {
    try {
      setExporting(true);
      await adminReferralsService.exportCsv(
        startDate,
        endDate,
        referreduserType === "all" ? undefined : referreduserType,
      );
      toast.success("Referrals exported successfully");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to export referrals",
      );
    } finally {
      setExporting(false);
    }
  };
  const hasFilters =
    !!referredUid || !!referralCodeUsed || referreduserType !== "all";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground">
          Track individual referrals by referred user, user type, and referral
          code.
        </p>
      </div>
      <ReferralSummaryCards />
      <Card>
        <CardHeader>
          <CardTitle>Referral Details</CardTitle>
          <CardDescription>
            Each row is one referral. Search and filters cover all records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="referral-user-id">Referred user ID</Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                />
                <Input
                  id="referral-user-id"
                  placeholder="Enter the exact referred user ID"
                  value={referredUid}
                  onChange={(event) => setReferredUid(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral-user-type">Referred user type</Label>
              <Select
                value={referreduserType}
                onValueChange={setReferreduserType}
              >
                <SelectTrigger id="referral-user-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="rider">Rider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral-code">Referral code used</Label>
              <Input
                id="referral-code"
                placeholder="Enter the exact referral code"
                value={referralCodeUsed}
                onChange={(event) => setReferralCodeUsed(event.target.value)}
              />
            </div>
          </div>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setReferredUid("");
                setReferralCodeUsed("");
                setReferreduserType("all");
                setSearch({ referredUid: "", referralCodeUsed: "" });
              }}
            >
              Clear filters
            </Button>
          )}
          {list.error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 text-sm text-destructive"
            >
              <span>{list.error}</span>
              <Button variant="outline" size="sm" onClick={list.retry}>
                Retry list
              </Button>
            </div>
          )}
          <div
            ref={viewport}
            role="region"
            aria-label="Referrals table"
            tabIndex={0}
            aria-busy={list.loading}
            className="h-[32rem] overflow-auto rounded-lg border [scrollbar-gutter:stable] [&>div]:overflow-visible [&>div]:border-0 [&>div]:rounded-none"
          >
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10">
                <TableRow>
                  <TableHead>Referral ID</TableHead>
                  <TableHead>Referred UID</TableHead>
                  <TableHead>Referrer UID</TableHead>
                  <TableHead>User type</TableHead>
                  <TableHead>Referral code</TableHead>
                  <TableHead>Created (Lagos)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.loading ? (
                  Array.from({ length: list.limit }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((_, cell) => (
                        <TableCell key={cell}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : list.data?.items.length ? (
                  list.data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {item.id}
                      </TableCell>
                      <TableCell>
                        {item.referredUid || "Not recorded"}
                      </TableCell>
                      <TableCell>
                        {item.referrerUid ? (
                          <Link
                            className="text-primary underline underline-offset-4"
                            to={`/referrals/${encodeURIComponent(item.referrerUid)}`}
                          >
                            {item.referrerUid}
                          </Link>
                        ) : (
                          "Not recorded"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.referreduserType || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.referralCodeUsed || "Not recorded"}
                      </TableCell>
                      <TableCell>{createdDate(item.createdAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {list.error
                        ? "Referral records are unavailable. Retry the list to continue."
                        : hasFilters
                          ? "No referrals match these filters."
                          : "No referrals found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <nav
            aria-label="Referral pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Label htmlFor="referral-page-size">Rows per page</Label>
              <Select
                value={String(list.limit)}
                onValueChange={(value) =>
                  list.setLimit(Number(value) as ReferralLimit)
                }
                disabled={list.loading}
              >
                <SelectTrigger id="referral-page-size" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_LIMITS.map((limit) => (
                    <SelectItem key={limit} value={String(limit)}>
                      {limit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p
              role="status"
              className="text-sm tabular-nums text-muted-foreground"
            >
              {list.loading
                ? "Loading referrals…"
                : list.error
                  ? "Unable to load referrals"
                  : `Page ${list.pageIndex + 1} · ${list.data?.items.length ?? 0} referrals`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={list.loading || list.pageIndex === 0}
                onClick={list.previous}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={list.loading || !list.data?.hasMore}
                onClick={list.next}
              >
                Next
              </Button>
            </div>
          </nav>
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Export referrals</p>
            <p className="text-sm text-muted-foreground">
              Export all referrals in the date range and selected user type.
              User ID and referral code filters do not restrict exports. Dates
              include the full day in Lagos.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="referral-export-start">Start date</Label>
                <Input
                  id="referral-export-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={exporting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referral-export-end">End date</Label>
                <Input
                  id="referral-export-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={exporting}
                />
              </div>
              <ExportButton
                onClick={exportCsv}
                loading={exporting}
                disabled={!startDate || !endDate || startDate > endDate}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
