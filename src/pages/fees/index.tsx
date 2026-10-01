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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { feesService } from "@/services/fees.service";
import type { Fee } from "@/types";
import { FeeType } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getFeeTypeName = (feeType?: FeeType) => {
  if (feeType === FeeType.fooddeliveryfee) return "Food Delivery";
  if (feeType === FeeType.servicefee) return "Service Fee";
  if (feeType === FeeType.ridehauling) return "Ride Hauling";
  if (feeType === FeeType.ridersnormalcut) return "Riders Normal Cut";
  return "Unknown";
};

// Check if fee type uses percentage values instead of Naira
const isPercentageFee = (feeType?: FeeType) => {
  return feeType === FeeType.ridersnormalcut;
};

const formatFeeValue = (value: number, feeType?: FeeType) => {
  if (isPercentageFee(feeType)) {
    return `${(value * 100).toFixed(0)}%`;
  }
  return `₦${formatAmount(value)}`;
};

export default function FeesPage() {
  const pagination = useFirestorePagination();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [editValues, setEditValues] = useState({
    bookingFee: "",
    perKm: "",
    perMin: "",
    perWeight: "",
    minFare: "",
    surgeMultiplier: "",
    addedSurge: "",
    value: "",
  });

  useEffect(() => {
    loadFees();
  }, [pagination.options]);

  const loadFees = async () => {
    try {
      setLoading(true);
      const data = await feesService.getAllFees(pagination.options);
      setFees(data);
    } catch (error) {
      console.error("Error loading fees:", error);
      toast.error("Failed to load fees");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (fee: Fee) => {
    setEditingFee(fee);
    setEditValues({
      bookingFee: (fee.bookingFee || 0).toString(),
      perKm: (fee.perKm || 0).toString(),
      perMin: (fee.perMin || 0).toString(),
      perWeight: (fee.perWeight || 0).toString(),
      minFare: (fee.minFare || 0).toString(),
      surgeMultiplier: (fee.surgeMultiplier || 0).toString(),
      addedSurge: (fee.addedSurge || 0).toString(),
      value: (fee.value || 0).toString(),
    });
  };

  const handleUpdateFee = async () => {
    if (!editingFee?.id) return;

    try {
      const updates = {
        bookingFee: parseFloat(editValues.bookingFee) || 0,
        perKm: parseFloat(editValues.perKm) || 0,
        perMin: parseFloat(editValues.perMin) || 0,
        perWeight: parseFloat(editValues.perWeight) || 0,
        minFare: parseFloat(editValues.minFare) || 0,
        surgeMultiplier: parseFloat(editValues.surgeMultiplier) || 0,
        addedSurge: parseFloat(editValues.addedSurge) || 0,
        value: parseFloat(editValues.value) || 0,
      };

      await feesService.updateFee(editingFee.id, updates);
      toast.success("Fee updated successfully");
      await loadFees();
      setEditingFee(null);
    } catch (error) {
      console.error("Error updating fee:", error);
      toast.error("Failed to update fee");
    }
  };

  const totalFees = fees.length;
  const totalBookingFees = fees.reduce(
    (sum, f) => sum + (f.bookingFee || 0),
    0
  );
  const avgPerKm =
    fees.length > 0
      ? fees.reduce((sum, f) => sum + (f.perKm || 0), 0) / fees.length
      : 0;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees Management</h1>
          <p className="text-muted-foreground">View and update platform fees</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Fees Management</h1>
        <p className="text-muted-foreground">View and update platform fees</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Fee Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Booking Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{formatAmount(totalBookingFees)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Per Km Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{formatAmount(avgPerKm)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Fees Table */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Fees</CardTitle>
          <CardDescription>Click Edit to update fee values</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Booking Fee</TableHead>
                  <TableHead>Per Km</TableHead>
                  <TableHead>Per Min</TableHead>
                  <TableHead>Per Weight</TableHead>
                  <TableHead>Min Fare</TableHead>
                  <TableHead>Surge Mult.</TableHead>
                  <TableHead>Added Surge</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center text-muted-foreground py-8"
                    >
                      No fees found
                    </TableCell>
                  </TableRow>
                ) : (
                  fees.map((fee) => (
                    <TableRow key={fee.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm">
                        {fee.name || "N/A"}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{formatAmount(fee.bookingFee || 0)}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{formatAmount(fee.perKm || 0)}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{formatAmount(fee.perMin || 0)}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{formatAmount(fee.perWeight || 0)}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{formatAmount(fee.minFare || 0)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {fee.surgeMultiplier || 0}x
                      </TableCell>
                      <TableCell className="text-sm">
                        {fee.addedSurge || 0}x
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatFeeValue(fee.value || 0, fee.feeType)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog
                          open={editingFee?.id === fee.id}
                          onOpenChange={(open) => !open && setEditingFee(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(fee)}
                            >
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Update {getFeeTypeName(fee.feeType)} Fee
                              </DialogTitle>
                              <DialogDescription>
                                Update fee values for this fee type
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="bookingFee">
                                    Booking Fee (₦)
                                  </Label>
                                  <Input
                                    id="bookingFee"
                                    type="number"
                                    value={editValues.bookingFee}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        bookingFee: e.target.value,
                                      })
                                    }
                                    placeholder="Enter booking fee"
                                    step="0.01"
                                    min="0"
                                    className="mt-2"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="perKm">Per Km Rate (₦)</Label>
                                  <Input
                                    id="perKm"
                                    type="number"
                                    value={editValues.perKm}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        perKm: e.target.value,
                                      })
                                    }
                                    placeholder="Enter per km rate"
                                    step="0.01"
                                    min="0"
                                    className="mt-2"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="perMin">
                                    Per Minute Rate (₦)
                                  </Label>
                                  <Input
                                    id="perMin"
                                    type="number"
                                    value={editValues.perMin}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        perMin: e.target.value,
                                      })
                                    }
                                    placeholder="Enter per minute rate"
                                    step="0.01"
                                    min="0"
                                    className="mt-2"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="perWeight">
                                    Per Weight Rate (₦)
                                  </Label>
                                  <Input
                                    id="perWeight"
                                    type="number"
                                    value={editValues.perWeight}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        perWeight: e.target.value,
                                      })
                                    }
                                    placeholder="Enter per weight rate"
                                    step="0.01"
                                    min="0"
                                    className="mt-2"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="minFare">
                                    Minimum Fare (₦)
                                  </Label>
                                  <Input
                                    id="minFare"
                                    type="number"
                                    value={editValues.minFare}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        minFare: e.target.value,
                                      })
                                    }
                                    placeholder="Enter minimum fare"
                                    step="0.01"
                                    min="0"
                                    className="mt-2"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="surgeMultiplier">
                                    Surge Multiplier
                                  </Label>
                                  <Input
                                    id="surgeMultiplier"
                                    type="number"
                                    value={editValues.surgeMultiplier}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        surgeMultiplier: e.target.value,
                                      })
                                    }
                                    placeholder="Enter surge multiplier"
                                    step="0.1"
                                    min="0"
                                    className="mt-2"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="addedSurge">
                                    Added Surge
                                  </Label>
                                  <Input
                                    id="addedSurge"
                                    type="number"
                                    value={editValues.addedSurge}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        addedSurge: e.target.value,
                                      })
                                    }
                                    placeholder="Enter added surge"
                                    step="0.1"
                                    min="0"
                                    className="mt-2"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="value">
                                    {isPercentageFee(editingFee?.feeType)
                                      ? "Value (0-1 percentage)"
                                      : "Value (₦)"}
                                  </Label>
                                  <Input
                                    id="value"
                                    type="number"
                                    value={editValues.value}
                                    onChange={(e) =>
                                      setEditValues({
                                        ...editValues,
                                        value: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      isPercentageFee(editingFee?.feeType)
                                        ? "Enter percentage (e.g., 0.3 for 30%)"
                                        : "Enter value"
                                    }
                                    step="0.01"
                                    min="0"
                                    max={isPercentageFee(editingFee?.feeType) ? "1" : undefined}
                                    className="mt-2"
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={handleUpdateFee}
                                className="w-full"
                              >
                                Update Fee
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
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
