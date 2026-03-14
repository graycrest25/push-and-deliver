import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/contexts/UserContext";
import { ecommerceMerchantsService } from "@/services/ecommerce-merchants.service";
import type { EcommerceMerchant } from "@/types";
import { ArrowLeft, Package, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getVerificationLabel = (status: number | undefined) => {
  return status === 1 ? "Verified" : "Unverified";
};

const getVerificationBadgeVariant = (status: number | undefined) => {
  if (status === 1) return "default";
  return "secondary";
};

export default function EcommerceMerchantDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<EcommerceMerchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newVerificationStatus, setNewVerificationStatus] = useState<number>(0);
  const [updating, setUpdating] = useState(false);
  const [hasTransactions, setHasTransactions] = useState(false);

  const { user } = useCurrentUser();
  const isSuperAdmin = user?.adminType === "super";
  const isViewOnly = user?.adminType === "customercare";

  useEffect(() => {
    if (id) {
      loadMerchantData();
      checkTransactions();
    }
  }, [id]);

  const loadMerchantData = async () => {
    try {
      setLoading(true);
      const merchantData = await ecommerceMerchantsService.getMerchantById(id!);

      if (!merchantData) {
        toast.error("Merchant not found");
        navigate("/ecommerce-merchants");
        return;
      }

      setMerchant(merchantData);
    } catch (error) {
      console.error("Error loading merchant:", error);
      toast.error("Failed to load merchant data");
    } finally {
      setLoading(false);
    }
  };

  const checkTransactions = async () => {
    try {
      const exists = await ecommerceMerchantsService.checkTransactionsExist(
        id!,
      );
      setHasTransactions(exists);
    } catch (error) {
      console.error("Error checking transactions:", error);
    }
  };

  const handleEditClick = () => {
    setNewVerificationStatus(merchant?.verificationStatus ?? 0);
    setEditDialogOpen(true);
  };

  const handleUpdateVerificationStatus = async () => {
    if (!merchant?.id) return;

    try {
      setUpdating(true);
      await ecommerceMerchantsService.updateMerchant(merchant.id, {
        verificationStatus: newVerificationStatus,
      });
      toast.success("Verification status updated successfully");
      setEditDialogOpen(false);
      await loadMerchantData();
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
        </div>
      </div>
    );
  }

  if (!merchant) {
    return null;
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/ecommerce-merchants")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Merchant Details
          </h1>
          <p className="text-muted-foreground">
            Complete information for {merchant.displayName || "merchant"}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={() => navigate(`/ecommerce-merchants/${id}/products`)}>
          <Package className="mr-2 h-4 w-4" />
          View Products
        </Button>
        {hasTransactions && (
          <Button
            variant="outline"
            onClick={() => navigate(`/ecommerce-merchants/${id}/transactions`)}
          >
            <Receipt className="mr-2 h-4 w-4" />
            View Transactions
          </Button>
        )}
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Display Name</p>
              <p className="font-medium">{merchant.displayName || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Legal Name</p>
              <p className="font-medium">{merchant.legalName || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{merchant.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="font-medium">{merchant.phonenumber || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Physical Address</p>
              <p className="font-medium">{merchant.physicalAddress || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Merchant ID</p>
              <p className="font-mono text-sm">{merchant.id || "N/A"}</p>
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
                        merchant.verificationStatus,
                      ) as any
                    }
                  >
                    {getVerificationLabel(merchant.verificationStatus)}
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
                        className={`h-6 text-xs ${isViewOnly ? "hidden" : ""}`}
                      >
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Verification Status</DialogTitle>
                        <DialogDescription>
                          Update the verification status for{" "}
                          {merchant.displayName || "this merchant"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="status">Verification Status</Label>
                          <Select
                            value={newVerificationStatus.toString()}
                            onValueChange={(value) =>
                              setNewVerificationStatus(parseInt(value))
                            }
                          >
                            <SelectTrigger id="status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Verified</SelectItem>
                              <SelectItem value="0">Unverified</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      {/* Store Information */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Store Slug</p>
              <p className="font-medium">{merchant.slug || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rating</p>
              <p className="font-medium">{merchant.rating ?? "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Store Status</p>
              <Badge variant={merchant.isOpen ? "default" : "secondary"}>
                {merchant.isOpen ? "Open" : "Closed"}
              </Badge>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Categories</p>
              <div className="flex gap-1 flex-wrap mt-1">
                {merchant.categories && merchant.categories.length > 0 ? (
                  merchant.categories.map((cat, idx) => (
                    <Badge key={idx} variant="outline">
                      {cat}
                    </Badge>
                  ))
                ) : (
                  <p className="font-medium">N/A</p>
                )}
              </div>
            </div>
            {merchant.shopImage && (
              <div className="col-span-3">
                <p className="text-sm text-muted-foreground mb-2">Shop Image</p>
                <img
                  src={merchant.shopImage}
                  alt="Shop"
                  className="h-32 rounded-lg object-cover"
                />
              </div>
            )}
            <div className="col-span-3">
              <p className="text-sm text-muted-foreground mb-3">
                Business Documents
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: "Utility Bill", src: merchant.utilityImage },
                  { label: "Restaurant Image", src: merchant.restaurantImage },
                  { label: "CAC Document", src: merchant.cacImage },
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storefront */}
      {merchant.storefront && (
        <Card>
          <CardHeader>
            <CardTitle>Storefront</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">
                  {merchant.storefront.description || "N/A"}
                </p>
              </div>
              {merchant.storefront.heroImage && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Hero Image
                  </p>
                  <img
                    src={merchant.storefront.heroImage}
                    alt="Hero"
                    className="h-48 rounded-lg object-cover w-full"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Metrics */}
      {merchant.salesMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">
                  {merchant.salesMetrics.ordersCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">
                  {merchant.currency || "NGN"}{" "}
                  {formatAmount(merchant.salesMetrics.totalSales ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet & Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet & Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p
                className="text-2xl font-bold"
                style={{ color: "hsl(150, 35%, 42%)" }}
              >
                {merchant.currency || "NGN"}{" "}
                {formatAmount(merchant.walletBalance || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currency</p>
              <p className="font-medium">{merchant.currency || "NGN"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tax Rate</p>
              <p className="font-medium">{merchant.taxRatePercent ?? 0}%</p>
            </div>
            {merchant.settings && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Auto Accept Orders
                  </p>
                  <Badge
                    variant={
                      merchant.settings.autoAcceptOrders
                        ? "default"
                        : "secondary"
                    }
                  >
                    {merchant.settings.autoAcceptOrders ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Inventory Check
                  </p>
                  <Badge
                    variant={
                      merchant.settings.requireInventoryCheck
                        ? "default"
                        : "secondary"
                    }
                  >
                    {merchant.settings.requireInventoryCheck
                      ? "Required"
                      : "Not Required"}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
