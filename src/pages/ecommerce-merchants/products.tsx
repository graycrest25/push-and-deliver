import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { Product } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function MerchantProductsPage() {
  const { id } = useParams<{ id: string }>();
  const pagination = useFirestorePagination(id ?? "");
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProducts();
    }
  }, [id, pagination.options]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await ecommerceMerchantsService.getMerchantProducts(id!, pagination.options);
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (productId: string) => {
    navigate(`/ecommerce-merchants/${id}/products/${productId}`);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
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
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Click a product to view it's details.
          </p>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>All products for this merchant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <><Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Image</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Has Variants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleProductClick(product.id!)}
                    >
                      <TableCell>
                        {product.imageUrls && product.imageUrls.length > 0 ? (
                          <img
                            src={product.imageUrls[0]}
                            alt="Product"
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            No image
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {product.category || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {product.description || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            product.hasVariants ? "default" : "secondary"
                          }
                        >
                          {product.hasVariants ? "Yes" : "No"}
                        </Badge>
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
