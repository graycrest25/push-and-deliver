import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, Search } from "lucide-react";
import { ecommerceMerchantsService } from "@/services/ecommerce-merchants.service";
import type { EcommerceMerchant } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const formatAmount = (amount: number) => {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getVerificationBadgeVariant = (status: number | undefined) => {
  if (status === 1) return "default";
  return "secondary";
};

const getVerificationLabel = (status: number | undefined) => {
  return status === 1 ? "Verified" : "Unverified";
};

const truncateText = (text: string | undefined, maxLength: number = 30) => {
  if (!text) return "N/A";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

export default function EcommerceMerchantsPage() {
  const pagination = useFirestorePagination();
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<EcommerceMerchant[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<
    EcommerceMerchant[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [merchantsWithTransactions, setMerchantsWithTransactions] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    loadMerchants();
  }, [pagination.options]);

  useEffect(() => {
    filterMerchants();
  }, [merchants, searchQuery, activeTab]);

  const loadMerchants = async () => {
    try {
      setLoading(true);
      const data = await ecommerceMerchantsService.getAllMerchants(pagination.options);
      setMerchants(data);

      // Check which merchants have transactions
      const transactionChecks = await Promise.all(
        data.map(async (merchant) => ({
          id: merchant.id!,
          hasTransactions:
            await ecommerceMerchantsService.checkTransactionsExist(
              merchant.id!
            ),
        }))
      );

      const merchantsWithTxns = new Set(
        transactionChecks
          .filter((check) => check.hasTransactions)
          .map((check) => check.id)
      );
      setMerchantsWithTransactions(merchantsWithTxns);
    } catch (error) {
      console.error("Error loading merchants:", error);
      toast.error("Failed to load merchants");
    } finally {
      setLoading(false);
    }
  };

  const filterMerchants = () => {
    let filtered = [...merchants];

    // Filter by tab
    if (activeTab === "verified") {
      filtered = filtered.filter((m) => m.verificationStatus === 1);
    } else if (activeTab === "unverified") {
      filtered = filtered.filter((m) => m.verificationStatus === 0);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.displayName?.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query) ||
          m.phonenumber?.toLowerCase().includes(query)
      );
    }

    setFilteredMerchants(filtered);
  };

  const handleViewDetails = (merchantId: string) => {
    navigate(`/ecommerce-merchants/${merchantId}`);
  };

  const handleViewProducts = (merchantId: string) => {
    navigate(`/ecommerce-merchants/${merchantId}/products`);
  };

  const handleViewTransactions = (merchantId: string) => {
    navigate(`/ecommerce-merchants/${merchantId}/transactions`);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          E-commerce Merchants
        </h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
        <p className="text-muted-foreground">
          Manage merchant accounts and verification status
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Merchants</CardTitle>
          <CardDescription>
            View and manage all e-commerce merchants in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="verified">Verified</TabsTrigger>
                <TabsTrigger value="unverified">Unverified</TabsTrigger>
              </TabsList>
              <div className="relative w-80">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search this page: by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <TabsContent value={activeTab} className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <><Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Wallet Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMerchants.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          No merchants found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMerchants.map((merchant) => (
                        <TableRow key={merchant.id}>
                          <TableCell className="font-medium">
                            {merchant.displayName || "N/A"}
                          </TableCell>
                          <TableCell>{merchant.email || "N/A"}</TableCell>
                          <TableCell>{merchant.phonenumber || "N/A"}</TableCell>
                          <TableCell
                            className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap"
                            title={merchant.physicalAddress}
                          >
                            {truncateText(merchant.physicalAddress)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {merchant.currency || "NGN"}{" "}
                            {formatAmount(merchant.walletBalance || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                getVerificationBadgeVariant(
                                  merchant.verificationStatus
                                ) as any
                              }
                            >
                              {getVerificationLabel(
                                merchant.verificationStatus
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleViewDetails(merchant.id!)
                                  }
                                >
                                  Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleViewProducts(merchant.id!)
                                  }
                                >
                                  Products
                                </DropdownMenuItem>
                                {merchantsWithTransactions.has(
                                  merchant.id!
                                ) && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleViewTransactions(merchant.id!)
                                    }
                                  >
                                    Transactions
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table><TablePagination pagination={pagination} loading={loading} /></>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
