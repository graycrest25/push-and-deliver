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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { restaurantsService } from "@/services/restaurants.service";
import type { Restaurant } from "@/types";
import { VerificationStatus } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function VendorsPage() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await restaurantsService.getAllRestaurants();
      setRestaurants(data);
    } catch (error) {
      console.error("Error loading restaurants:", error);
      toast.error("Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurants.filter((r) => {
    const matchesSearch =
      r.legalname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.phonenumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || r.verificationStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleVerify = async (id: string) => {
    try {
      setActionLoading(id);
      await restaurantsService.verifyRestaurant(id);
      toast.success("Restaurant verified successfully");
      await loadRestaurants();
    } catch (error) {
      console.error("Error verifying restaurant:", error);
      toast.error("Failed to verify restaurant");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (id: string) => {
    try {
      setActionLoading(id);
      await restaurantsService.blockRestaurant(id);
      toast.success("Restaurant blocked successfully");
      await loadRestaurants();
    } catch (error) {
      console.error("Error blocking restaurant:", error);
      toast.error("Failed to block restaurant");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      setActionLoading(id);
      await restaurantsService.unblockRestaurant(id);
      toast.success("Restaurant unblocked successfully");
      await loadRestaurants();
    } catch (error) {
      console.error("Error unblocking restaurant:", error);
      toast.error("Failed to unblock restaurant");
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = (restaurant: Restaurant) => {
    if (restaurant.id) {
      navigate(`/vendors/${restaurant.id}`);
    }
  };

  const totalRestaurants = restaurants.length;
  const verifiedRestaurants = restaurants.filter(
    (r) => r.verificationStatus === VerificationStatus.verified,
  ).length;
  const blockedRestaurants = restaurants.filter(
    (r) => r.verificationStatus === VerificationStatus.blocked,
  ).length;
  const totalWalletBalance = restaurants.reduce(
    (sum, r) => sum + (r.walletbalance || 0),
    0,
  );

  const getStatusLabel = (status: VerificationStatus | undefined) => {
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

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Restaurants</h1>
          <p className="text-muted-foreground">Manage restaurants</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Restaurants</h1>
        <p className="text-muted-foreground">
          Manage restaurants, verification, and wallet balances
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Restaurants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRestaurants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifiedRestaurants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedRestaurants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Wallet Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{formatAmount(totalWalletBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restaurants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Details</CardTitle>
          <CardDescription>
            View all restaurants with verification status and wallet information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="mb-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value={VerificationStatus.verified}>
                  Verified
                </SelectItem>
                <SelectItem value={VerificationStatus.unverified}>
                  Pending
                </SelectItem>
                <SelectItem value={VerificationStatus.blocked}>
                  Blocked
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Wallet Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRestaurants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      No restaurants found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRestaurants.map((restaurant) => (
                    <TableRow
                      key={restaurant.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleViewDetails(restaurant)}
                    >
                      <TableCell className="font-medium">
                        {restaurant.legalname || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {restaurant.email || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {restaurant.phonenumber || "N/A"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {restaurant.physicalAddress || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            restaurant.verificationStatus ===
                            VerificationStatus.verified
                              ? "default"
                              : restaurant.verificationStatus ===
                                  VerificationStatus.blocked
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {getStatusLabel(restaurant.verificationStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={restaurant.isOpen ? "default" : "outline"}
                        >
                          {restaurant.isOpen ? "Open" : "Closed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦{formatAmount(restaurant.walletbalance || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading === restaurant.id}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* {restaurant.verificationStatus !== VerificationStatus.verified && (
                              <DropdownMenuItem onClick={() => handleVerify(restaurant.id!)}>
                                Verify Restaurant
                              </DropdownMenuItem>
                            )}
                            {restaurant.verificationStatus === VerificationStatus.blocked ? (
                              <DropdownMenuItem onClick={() => handleUnblock(restaurant.id!)}>
                                Unblock
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleBlock(restaurant.id!)}>
                                Block Restaurant
                              </DropdownMenuItem>
                            )} */}
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
