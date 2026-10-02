import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
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
import { ecommerceMerchantsService } from "@/services/ecommerce-merchants.service";
import type { Transaction } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/status-utils";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function MerchantTransactionsPage() {
  const { id } = useParams<{ id: string }>();
  const pagination = useFirestorePagination(id ?? "");
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTransactions();
    }
  }, [id, pagination.options]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await ecommerceMerchantsService.getMerchantTransactions(id!, pagination.options);
      setTransactions(data);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(`/ecommerce-merchants/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Merchant Transactions
          </h1>
          <p className="text-muted-foreground">
            View all transactions for this merchant
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
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
                            txn.transactionType === "Credit"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {txn.transactionType || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        {txn.narration || "N/A"}
                      </TableCell>
                      <TableCell className="font-medium">
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
              </Table><TablePagination pagination={pagination} loading={loading} /></>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
