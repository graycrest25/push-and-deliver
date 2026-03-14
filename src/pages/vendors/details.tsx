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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { restaurantsService } from "@/services/restaurants.service";
import type { Restaurant, Transaction } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/status-utils";
import { VerificationStatus } from "@/types";
import { useCurrentUser } from "@/contexts/UserContext";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getVerificationStatusLabel = (status: string | undefined) => {
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

const getVerificationBadgeVariant = (status: string | undefined) => {
  switch (status) {
    case VerificationStatus.verified:
      return "default";
    case VerificationStatus.blocked:
      return "destructive";
    case VerificationStatus.deleted:
      return "destructive";
    default:
      return "secondary";
  }
};

export default function VendorDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newVerificationStatus, setNewVerificationStatus] =
    useState<string>("");
  const [updating, setUpdating] = useState(false);
  const { user: currentAdmin } = useCurrentUser();
  const isSuperAdmin = currentAdmin?.adminType === "super";

  useEffect(() => {
    if (id) {
      loadRestaurantData();
      loadRestaurantTransactions();
    }
  }, [id]);

  const loadRestaurantData = async () => {
    try {
      setLoading(true);
      const restaurantData = await restaurantsService.getRestaurantById(id!);

      if (!restaurantData) {
        toast.error("Restaurant not found");
        navigate("/vendors");
        return;
      }

      setRestaurant(restaurantData);
    } catch (error) {
      console.error("Error loading restaurant:", error);
      toast.error("Failed to load restaurant data");
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurantTransactions = async () => {
    try {
      setLoadingTransactions(true);

      // Fetch from subcollection: Restaurants/{restaurantId}/Transactions
      const transactionsRef = collection(
        db,
        "Restaurants",
        id!,
        "Transactions",
      );
      const q = query(transactionsRef, orderBy("time", "desc"));
      const querySnapshot = await getDocs(q);

      const txns = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().time?.toDate?.(),
      })) as Transaction[];

      setTransactions(txns);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load restaurant transactions");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleEditClick = () => {
    setNewVerificationStatus(
      restaurant?.verificationStatus || VerificationStatus.unverified,
    );
    setEditDialogOpen(true);
  };

  const handleUpdateVerificationStatus = async () => {
    if (!restaurant?.id || !newVerificationStatus) return;

    try {
      setUpdating(true);
      await restaurantsService.updateRestaurant(restaurant.id, {
        verificationStatus: newVerificationStatus,
      });
      toast.success("Verification status updated successfully");
      setEditDialogOpen(false);
      await loadRestaurantData();
    } catch (error) {
      console.error("Error updating verification status:", error);
      toast.error("Failed to update verification status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/vendors")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Restaurant Details
          </h1>
          <p className="text-muted-foreground">
            Complete information for {restaurant.legalname || "restaurant"}
          </p>
        </div>
      </div>

      {/* Business Information */}
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Legal Name</p>
              <p className="font-medium">{restaurant.legalname || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{restaurant.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="font-medium">{restaurant.phonenumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Restaurant ID</p>
              <p className="font-mono text-sm">{restaurant.id || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Physical Address</p>
              <p className="font-medium">
                {restaurant.physicalAddress || "N/A"}
              </p>
            </div>
            {isSuperAdmin === true && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Verification Status
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      getVerificationBadgeVariant(
                        restaurant.verificationStatus,
                      ) as any
                    }
                  >
                    {getVerificationStatusLabel(restaurant.verificationStatus)}
                  </Badge>
                  <Dialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditClick}
                        className="h-6 text-xs"
                      >
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Verification Status</DialogTitle>
                        <DialogDescription>
                          Update the verification status for{" "}
                          {restaurant.legalname || "this restaurant"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="status">Verification Status</Label>
                          <Select
                            value={newVerificationStatus}
                            onValueChange={setNewVerificationStatus}
                          >
                            <SelectTrigger id="status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={VerificationStatus.verified}>
                                Verified
                              </SelectItem>
                              <SelectItem value={VerificationStatus.unverified}>
                                Unverified
                              </SelectItem>
                              <SelectItem value={VerificationStatus.blocked}>
                                Blocked
                              </SelectItem>
                              <SelectItem value={VerificationStatus.deleted}>
                                Deleted
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setEditDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleUpdateVerificationStatus}
                          disabled={updating}
                        >
                          {updating ? "Updating..." : "Update Status"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Rating</p>
              <p className="font-medium">
                {restaurant.rating
                  ? `${restaurant.rating.toFixed(1)} ⭐`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={restaurant.isOpen ? "default" : "secondary"}>
                {restaurant.isOpen ? "Open" : "Closed"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {restaurant.categories && restaurant.categories.length > 0 ? (
                  restaurant.categories.map((cat, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {cat}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">N/A</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">RC Number</p>
              {restaurant.rcNumber ? (
                <p className="font-mono text-sm">{restaurant.rcNumber}</p>
              ) : (
                <p className="font-medium">N/A</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">TIN Number</p>
              {restaurant.tinNumber ? (
                <p className="font-mono text-sm">{restaurant.tinNumber}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not provided
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {restaurant.openingHrs &&
            Object.keys(restaurant.openingHrs).length > 0 ? (
              Object.entries(restaurant.openingHrs).map(([day, hours]) => (
                <div
                  key={day}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <span className="font-medium capitalize">{day}</span>
                  <span className="text-sm text-muted-foreground">
                    {hours?.open && hours?.close
                      ? `${hours.open} - ${hours.close}`
                      : "Closed"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No operating hours set
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Wallet Information */}
      <Card>
        <CardHeader>
          <CardTitle>More Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p
                className="text-2xl font-bold"
                style={{ color: "hsl(150, 35%, 42%)" }}
              >
                ₦{formatAmount(restaurant.walletbalance || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Business Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Utility Bill", src: restaurant.utilityImage },
              { label: "Restaurant Image", src: restaurant.restaurantImage },
              { label: "CAC Document", src: restaurant.cacImage },
            ].map(({ label, src }) => (
              <div key={label} className="space-y-2">
                <p className="text-sm text-muted-foreground">{label}</p>
                {src ? (
                  <a href={src} target="_blank" rel="noopener noreferrer">
                    <img
                      src={src}
                      alt={label}
                      className="w-full h-48 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"
                    />
                  </a>
                ) : (
                  <div className="w-full h-48 rounded-lg border bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      No image uploaded
                    </p>
                  </div>
                )}
              </div>
            ))}
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
              <Table>
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
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
