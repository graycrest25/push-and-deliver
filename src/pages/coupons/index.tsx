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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { couponsService } from "@/services/coupons.service";
import type { Coupon } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCurrentUser } from "@/contexts/UserContext";

export default function CouponsPage() {
  const pagination = useFirestorePagination();
  const { user } = useCurrentUser();
  const isAdminViewOnly = user?.adminType === "customercare";

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState({
    percentageDiscount: "",
  });
  const [editValues, setEditValues] = useState({
    percentageDiscount: "",
    isActive: false,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    loadCoupons();
  }, [pagination.options]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await couponsService.getAllCoupons(pagination.options);
      setCoupons(data);
    } catch (error) {
      console.error("Error loading coupons:", error);
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async () => {
    const discount = parseFloat(createValues.percentageDiscount);
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      toast.error("Please enter a valid percentage (1-100)");
      return;
    }

    try {
      setCreateLoading(true);
      await couponsService.createCoupon({
        percentageDiscount: discount,
        isActive: true,
      });
      toast.success("Coupon created successfully");
      setIsCreateOpen(false);
      setCreateValues({ percentageDiscount: "" });
      await loadCoupons();
    } catch (error) {
      console.error("Error creating coupon:", error);
      toast.error("Failed to create coupon");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditClick = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setEditValues({
      percentageDiscount: coupon.percentageDiscount.toString(),
      isActive: coupon.isActive,
    });
  };

  const handleUpdateCoupon = async () => {
    if (!editingCoupon?.id) return;

    const discount = parseFloat(editValues.percentageDiscount);
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      toast.error("Please enter a valid percentage (1-100)");
      return;
    }

    try {
      setActionLoading(editingCoupon.id);
      await couponsService.updateCoupon(editingCoupon.id, {
        percentageDiscount: discount,
        isActive: editValues.isActive,
      });
      toast.success("Coupon updated successfully");
      setEditingCoupon(null);
      await loadCoupons();
    } catch (error) {
      console.error("Error updating coupon:", error);
      toast.error("Failed to update coupon");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;

    try {
      setActionLoading(id);
      await couponsService.deleteCoupon(id);
      toast.success("Coupon deleted successfully");
      await loadCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast.error("Failed to delete coupon");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground">Manage your platform coupons</p>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full mt-2" />
            <Skeleton className="h-8 w-full mt-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground">Manage your platform coupons</p>
        </div>
        {!isAdminViewOnly && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Coupon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Coupon</DialogTitle>
                <DialogDescription>
                  Create a new discount coupon for your users.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-percentage">
                    Percentage Discount (%)
                  </Label>
                  <Input
                    id="create-percentage"
                    type="number"
                    value={createValues.percentageDiscount}
                    onChange={(e) =>
                      setCreateValues({
                        percentageDiscount: e.target.value,
                      })
                    }
                    placeholder="e.g. 50"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateCoupon} disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Coupon"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
          <CardDescription>View and manage discount coupons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Coupon ID</TableHead>
                  <TableHead>Percentage Discount</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Status</TableHead>
                  {!isAdminViewOnly && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdminViewOnly ? 4 : 5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No coupons found
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons.map((coupon) => (
                    <TableRow key={coupon.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {coupon.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {coupon.percentageDiscount}%
                      </TableCell>
                      <TableCell>
                        {coupon.createdAt
                          ? format(
                              new Date(coupon.createdAt as Date),
                              "dd-MM-yyyy"
                            )
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={coupon.isActive ? "default" : "secondary"}
                        >
                          {coupon.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {!isAdminViewOnly && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditClick(coupon)}
                              >
                                Update
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  coupon.id && handleDeleteCoupon(coupon.id)
                                }
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table><TablePagination pagination={pagination} loading={loading} /></>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog - Show only if not view only (though button is hidden) */}
      {!isAdminViewOnly && (
        <Dialog
          open={!!editingCoupon}
          onOpenChange={(open) => !open && setEditingCoupon(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Coupon</DialogTitle>
              <DialogDescription>
                Modify the coupon details below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-percentage">Percentage Discount (%)</Label>
                <Input
                  id="edit-percentage"
                  type="number"
                  value={editValues.percentageDiscount}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      percentageDiscount: e.target.value,
                    })
                  }
                  placeholder="e.g. 50"
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="edit-isActive">Active Status</Label>
                <Switch
                  id="edit-isActive"
                  checked={editValues.isActive}
                  onCheckedChange={(checked) =>
                    setEditValues({
                      ...editValues,
                      isActive: checked,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingCoupon(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateCoupon}
                disabled={actionLoading === editingCoupon?.id}
              >
                {actionLoading === editingCoupon?.id
                  ? "Updating..."
                  : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
