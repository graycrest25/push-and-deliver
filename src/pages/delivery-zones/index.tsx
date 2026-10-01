import { TablePagination } from "@/components/table-pagination";
import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion } from "@/components/ui/accordion";
import { deliveryZonesService } from "@/services/delivery-zones.service";
import type { State } from "@/types";
import { toast } from "sonner";
import { LoadingModal } from "@/components/shared/Loader";
import { StateAccordionItem } from "./components/state-accordion";
import { IconMapPin, IconSearch } from "@tabler/icons-react";

export default function DeliveryZonesPage() {
  const pagination = useFirestorePagination();
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadStates();
  }, [pagination.options]);

  const loadStates = async () => {
    try {
      setLoading(true);
      const data = await deliveryZonesService.getAllStates(pagination.options);
      // Sort alphabetically
      data.sort((a, b) => a.name.localeCompare(b.name));
      setStates(data);
    } catch (error) {
      console.error("Error loading states:", error);
      toast.error("Failed to load states");
    } finally {
      setLoading(false);
    }
  };

  const filteredStates = useMemo(() => {
    if (!searchQuery) return states;
    const lowerQuery = searchQuery.toLowerCase();
    return states.filter((state) =>
      state.name.toLowerCase().includes(lowerQuery)
    );
  }, [states, searchQuery]);

  if (loading) {
    return <LoadingModal />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delivery Zones</h1>
        <p className="text-sm text-muted-foreground">Search, filters, summaries, and exports apply to the current page.</p>
        <p className="text-muted-foreground mt-2">
          Manage delivery fees for States and LGAs
        </p>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All States</CardTitle>
            <div className="relative w-64">
              <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page: states..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <CardDescription>
            Click a state to view and edit LGA delivery fees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredStates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <IconMapPin className="h-12 w-12 text-muted-foreground/30 mb-2" />
              <p>No states found matching "{searchQuery}"</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filteredStates.map((state) => (
                <StateAccordionItem key={state.id} state={state} />
              ))}
            </Accordion>
          )}
        <TablePagination pagination={pagination} loading={loading} />
</CardContent>
      </Card>
    </div>
  );
}
