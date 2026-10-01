import { useFirestorePagination } from "@/hooks/use-firestore-pagination";
import { TablePagination } from "@/components/table-pagination";
import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { deliveryZonesService } from "@/services/delivery-zones.service";
import type { State, LGA } from "@/types";
import { toast } from "sonner";
import { IconDeviceFloppy, IconLoader, IconPencil } from "@tabler/icons-react";

interface StateAccordionItemProps {
  state: State;
}

export function StateAccordionItem({ state }: StateAccordionItemProps) {
  const pagination = useFirestorePagination(state.id);
  const [lgas, setLgas] = useState<LGA[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchLGAs = async () => {
    try {
      setLoading(true);
      const data = await deliveryZonesService.getLGAsForState(state.id, pagination.options);
      setLgas(data);
      setLoaded(true);
    } catch (error) {
      toast.error("Failed to load LGAs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (loaded) void fetchLGAs(); }, [pagination.options, state.id]);

  const handleEdit = (lga: LGA) => {
    setEditingId(lga.id);
    setEditValue(lga.deliveryfee.toString());
  };

  const handleSave = async (lga: LGA) => {
    const fee = parseFloat(editValue);
    if (isNaN(fee)) {
      toast.error("Please enter a valid number");
      return;
    }

    try {
      setSavingId(lga.id);
      await deliveryZonesService.updateLGAFee(state.id, lga.id, fee);

      // Update local state
      setLgas(
        lgas.map((item) =>
          item.id === lga.id ? { ...item, deliveryfee: fee } : item
        )
      );

      setEditingId(null);
      toast.success("Delivery fee updated");
    } catch (error) {
      toast.error("Failed to update fee");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AccordionItem value={state.id}>
      <AccordionTrigger onClick={() => { if (!loaded) void fetchLGAs(); }} className="hover:no-underline">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg">{state.name}</span>
          <Badge variant="outline" className="ml-2 font-normal">
            {loaded ? `${lgas.length} LGAs` : "Click to load"}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="px-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : lgas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No LGAs found for this state
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LGA Name</TableHead>
                    <TableHead className="w-[300px]">
                      Delivery Fee (₦)
                    </TableHead>
                    <TableHead className="w-[100px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lgas.map((lga) => (
                    <TableRow key={lga.id}>
                      <TableCell className="font-medium">{lga.name}</TableCell>
                      <TableCell>
                        {editingId === lga.id ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 max-w-[200px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(lga);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          <span>₦{lga.deliveryfee.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === lga.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                              disabled={savingId === lga.id}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSave(lga)}
                              disabled={savingId === lga.id}
                            >
                              {savingId === lga.id ? (
                                <IconLoader className="h-4 w-4 animate-spin" />
                              ) : (
                                <IconDeviceFloppy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(lga)}
                          >
                            <IconPencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table><TablePagination pagination={pagination} loading={loading} />
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
