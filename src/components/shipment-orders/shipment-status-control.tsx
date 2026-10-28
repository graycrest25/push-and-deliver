import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { isDevelopmentMode } from "@/lib/environment";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/contexts/UserContext";
import { getShipmentStatusActions, shipmentStatusLabels } from "@/lib/shipment-status";
import { shipmentOrdersService, ShipmentStatusError } from "@/services/shipment-orders.service";
import { ShipmentOrderStatus, type ShipmentOrder } from "@/types";

export function ShipmentStatusControl({ order, onRefresh }: {
  order: ShipmentOrder;
  onRefresh: () => Promise<void>;
}) {
  const { user, refetchUser } = useCurrentUser();
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const submitting = useRef(false);
  const [riderID, setRiderID] = useState("");
  const canUpdate = !accessDenied && user?.isAdmin === true &&
    ["super", "regular", "customercare"].includes(user.adminType ?? "");
  const actions = getShipmentStatusActions(order, isDevelopmentMode);
  const selectedAction = actions.find((action) => action.value === target);
  const acceptingRider = selectedAction?.value === "AcceptedByRider";

  async function refresh() {
    try {
      await onRefresh();
      setRefreshRequired(false);
    } catch {
      setRefreshRequired(true);
      toast.error("Could not refresh shipment. Refresh before updating its status again.");
    }
  }

  async function submit() {
    if (submitting.current || !order.id || !canUpdate || !selectedAction || refreshRequired) return;
    if (acceptingRider && !riderID.trim()) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      await shipmentOrdersService.updateOrderStatus(order.id, selectedAction.value, acceptingRider ? riderID.trim() : undefined);
      toast.success("Shipment status updated successfully");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update shipment status");
      if (error instanceof ShipmentStatusError && (error.status === 401 || error.status === 403)) {
        setAccessDenied(true);
        await refetchUser().catch(() => undefined);
      }
    } finally {
      // Also refresh conflicts and lost responses: the server may have committed.
      await refresh();
      setTarget("");
      setRiderID("");
      setPending(false);
      submitting.current = false;
    }
  }

  return (
    <div className="space-y-3" aria-busy={pending}>
      <p className="font-medium" aria-live="polite">
        {shipmentStatusLabels[order.orderStatus ?? -1] ?? "Unknown status"}
      </p>
      {order.orderStatus === ShipmentOrderStatus.placed && !order.riderID && (
        <p className="text-sm">Waiting for a rider to accept this shipment.</p>
      )}
      {order.orderStatus === ShipmentOrderStatus.acceptedByRider && (
        <p className="text-sm">Waiting for the assigned rider to verify pickup with the pickup OTP.</p>
      )}
      {order.orderStatus === ShipmentOrderStatus.onrouteToDestination && order.paylater === true && order.ispaid !== true && (
        <p className="text-sm">Payment must be confirmed before delivery can be completed.</p>
      )}
      {canUpdate && actions.length > 0 && (
        <>
          <Label htmlFor="shipment-status-action">Update status</Label>
          <Select value={selectedAction ? target : ""} onValueChange={setTarget} disabled={pending || refreshRequired}>
            <SelectTrigger id="shipment-status-action" className="bg-white dark:bg-gray-900">
              <SelectValue placeholder="Select an action" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((action) => <SelectItem key={action.value} value={action.value}>{action.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isDevelopmentMode && acceptingRider && (
            <div className="space-y-2">
              <Label htmlFor="shipment-rider-id">Rider ID</Label>
              <Input id="shipment-rider-id" value={riderID} onChange={(event) => setRiderID(event.target.value)} placeholder="Rider Firebase user ID" disabled={pending || refreshRequired} required />
              <p className="text-sm">Use a verified rider with a stored location. Pickup still requires the rider's OTP verification.</p>
            </div>
          )}
          <Button type="button" onClick={submit} disabled={pending || refreshRequired || !selectedAction || (acceptingRider && !riderID.trim())}>
            {pending ? "Updating…" : selectedAction?.label ?? "Update status"}
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {accessDenied && <p className="text-sm">Sign in with an authorized admin account to update shipment status.</p>}
      {refreshRequired && <Button type="button" variant="outline" onClick={refresh} disabled={pending}>Refresh shipment</Button>}
    </div>
  );
}
