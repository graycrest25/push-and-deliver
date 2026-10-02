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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { dhlZonesService } from "@/services/dhl-zones.service";
import type { DHLZone } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Pencil } from "lucide-react";
import { useCurrentUser } from "@/contexts/UserContext";

export default function DHLZonesPage() {
  const { user } = useCurrentUser();
  const isAdminViewOnly =
    user?.adminType === "customercare" || user?.adminType === "verifier";

  const [zones, setZones] = useState<DHLZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingZone, setEditingZone] = useState<{
    index: number;
    zone: DHLZone;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      const data = await dhlZonesService.getZones();
      setZones(data);
    } catch (error) {
      console.error("Error loading DHL zones:", error);
      toast.error("Failed to load DHL zones");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (index: number, zone: DHLZone) => {
    setEditingZone({ index, zone });
    setEditValue(zone.zone.toString());
  };

  const handleUpdateZone = async () => {
    if (!editingZone) return;

    const newZoneValue = parseInt(editValue, 10);
    if (isNaN(newZoneValue) || newZoneValue < 0) {
      toast.error("Please enter a valid zone number (0 or greater)");
      return;
    }

    try {
      setActionLoading(true);
      await dhlZonesService.updateZone(editingZone.index, newZoneValue);
      toast.success(
        `Zone for ${editingZone.zone.country} updated successfully`
      );
      setEditingZone(null);
      await loadZones();
    } catch (error) {
      console.error("Error updating zone:", error);
      toast.error("Failed to update zone");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredZones = zones
    .map((zone, index) => ({ ...zone, originalIndex: index }))
    .filter(
      (z) =>
        z.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        z.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const uniqueZoneNumbers = [...new Set(zones.map((z) => z.zone))].sort(
    (a, b) => a - b
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DHL Zones</h1>
          <p className="text-muted-foreground">
            Manage DHL shipping zone configurations
          </p>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">DHL Zones</h1>
        <p className="text-muted-foreground">
          Manage DHL shipping zone configurations by country
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Countries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{zones.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Zone Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueZoneNumbers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Zones: {uniqueZoneNumbers.join(", ")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Most Common Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {zones.length > 0
                ? Object.entries(
                    zones.reduce(
                      (acc, z) => {
                        acc[z.zone] = (acc[z.zone] || 0) + 1;
                        return acc;
                      },
                      {} as Record<number, number>
                    )
                  ).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"
                : "N/A"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Filtered Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredZones.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Zones Table */}
      <Card>
        <CardHeader>
          <CardTitle>Zone Configuration</CardTitle>
          <CardDescription>
            View and edit DHL shipping zones for each country
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by country or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Country</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Zone</TableHead>
                  {!isAdminViewOnly && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredZones.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdminViewOnly ? 3 : 4}
                      className="text-center text-muted-foreground py-8"
                    >
                      No zones found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredZones.map((zone) => (
                    <TableRow
                      key={`${zone.code}-${zone.originalIndex}`}
                      className="hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        {zone.country}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{zone.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Zone {zone.zone}</Badge>
                      </TableCell>
                      {!isAdminViewOnly && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleEditClick(zone.originalIndex, zone)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingZone}
        onOpenChange={(open) => !open && setEditingZone(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
            <DialogDescription>
              Update the zone number for {editingZone?.zone.country} (
              {editingZone?.zone.code})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-zone">Zone Number</Label>
              <Input
                id="edit-zone"
                type="number"
                min="0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter zone number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingZone(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateZone} disabled={actionLoading}>
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
