import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
import { getPaginatedDocs } from "@/lib/firestore-pagination";
"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { usersService } from "@/services/users.service";
import { referralsService } from "@/services/referrals.service";
import type { User, Transaction } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/status-utils";
import { cn } from "@/lib/utils";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const pagination = useFirestorePagination(id ?? "");
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  useEffect(() => {
    if (id) {
      loadUserData();
      loadUserTransactions();
    }
  }, [id, pagination.options]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const [userData, referralsData] = await Promise.all([
        usersService.getUserById(id!),
        referralsService.getReferralCountByReferrerId(id!),
      ]);

      if (!userData) {
        toast.error("User not found");
        navigate("/users");
        return;
      }

      setUser(userData);

      setReferralCount(referralsData);
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const loadUserTransactions = async () => {
    try {
      setLoadingTransactions(true);

      // Fetch from subcollection: Users/{userId}/Transactions
      const transactionsRef = collection(db, "Users", id!, "Transactions");
      const q = query(transactionsRef, orderBy("time", "desc"));
      const querySnapshot = await getPaginatedDocs(q, pagination.options);

      const txns = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().time?.toDate?.(),
      })) as Transaction[];

      setTransactions(txns);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load user transactions");
    } finally {
      setLoadingTransactions(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/users")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Details</h1>
          <p className="text-muted-foreground">
            Complete information for {user.username || user.email || "user"}
          </p>
        </div>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-medium">{user.username || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="font-medium">{user.phonenumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-sm">{user.id || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Device Name</p>
              <p className="font-medium">{user.deviceName || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Joined</p>
              <p className="font-medium">
                {user.createdAt instanceof Date
                  ? user.createdAt.toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet & Referral Information */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet & Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p
                className="text-2xl font-bold"
                style={{ color: "var(--success)" }}
              >
                ₦{formatAmount(user.walletbalance || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reward Points</p>
              <p
                className="text-2xl font-bold"
                style={{ color: "var(--primary)" }}
              >
                {user.rewardpoints || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
              <p className="text-2xl font-bold">{referralCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Referral ID</p>
              <p className="font-mono text-sm">{user.referralID || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Referred By</p>
              <p className="font-medium">{user.referredBy || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transactions found
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <><Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-sm">
                        {txn.time instanceof Date
                          ? txn.time.toLocaleString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            txn.transactionType === 0 ? "default" : "secondary"
                          }
                        >
                          {txn.transactionType === 0
                            ? "Credit"
                            : txn.transactionType === 1
                              ? "Debit"
                              : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        {txn.narration || "N/A"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium",
                          txn.transactionType === 0
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                      >
                        ₦{formatAmount(txn.amount || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(txn.status) as any}
                        >
                          {getStatusLabel(txn.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {txn.trxref || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table><TablePagination pagination={pagination} loading={loadingTransactions} /></>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
