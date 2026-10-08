import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shipmentOrdersService } from "@/services/shipment-orders.service";
import { IntlShipmentType, type ShipmentOrder } from "@/types";

export function ShipmentFeeForm({ order }: { order: ShipmentOrder }) {
  const isPayLater = order.shipmentType === IntlShipmentType.express && order.paylater === true;
  const initialAmount = isPayLater && order.totalAmount != null ? String(order.totalAmount) : "";
  const [amount, setAmount] = useState(initialAmount);
  const [weight, setWeight] = useState("");
  const [reference, setReference] = useState(() => `shipment-fee-${crypto.randomUUID()}`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ authurl: string; reference: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || result) return;
    if (!order.id) {
      setError("This shipment has no document ID. Reload the shipment and try again.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const response = await shipmentOrdersService.resolveShipmentFee({
        orderId: order.id,
        amount: Number(amount),
        reference,
        ...(weight.trim() ? { newweightinKG: Number(weight) } : {}),
      });
      setResult(response);
      toast.success("Shipment fee checkout link created");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to resolve shipment fee");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCheckoutUrl() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.authurl);
      toast.success("Checkout URL copied");
    } catch {
      toast.error("Could not copy automatically. Select the checkout URL and copy it manually.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isPayLater ? "Shipment fee payment" : "Additional shipment fee"}</CardTitle>
        <CardDescription>{isPayLater ? "Create a checkout link to pay the shipment fee in naira." : "Create a checkout link for an additional fee in naira."} Sender: {order.senderemailaddress || "No email address"}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={submitting || !!result} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shipment-fee-amount">{isPayLater ? "Shipment fee (₦)" : "Additional fee (₦)"}</Label>
              <Input id="shipment-fee-amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
              <p className="text-sm text-muted-foreground">{isPayLater ? "Enter the shipment fee to collect from the sender." : "Enter the additional fee, not the new total."}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipment-fee-weight">Final weight (kg, optional)</Label>
              <Input id="shipment-fee-weight" type="number" min="0" step="any" value={weight} onChange={(event) => setWeight(event.target.value)} />
              <p className="text-sm text-muted-foreground">Leave blank to preserve the existing weight.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shipment-fee-reference">Payment reference</Label>
              <Input id="shipment-fee-reference" required pattern="[A-Za-z0-9._=\-]+" value={reference} onChange={(event) => setReference(event.target.value)} />
              <p className="text-sm text-muted-foreground">Use a unique reference with letters, numbers, ., _, =, or -.</p>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {!order.senderemailaddress && <p className="text-sm text-destructive">Add a sender email address to this shipment before creating a checkout link.</p>}
          {!result && <Button type="submit" disabled={submitting || !order.senderemailaddress}>{submitting ? "Creating checkout link…" : "Create checkout link"}</Button>}
          {result && (
            <div className="space-y-3" aria-live="polite">
              <p className="text-sm">Checkout link created. Share it with the sender to collect payment.</p>
              <Label htmlFor="shipment-fee-url">Checkout URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="shipment-fee-url" readOnly value={result.authurl} onFocus={(event) => event.target.select()} />
                <Button type="button" variant="outline" onClick={copyCheckoutUrl}>Copy URL</Button>
              </div>
              <Button type="button" variant="outline" onClick={() => {
                setResult(null);
                setAmount(initialAmount);
                setWeight("");
                setReference(`shipment-fee-${crypto.randomUUID()}`);
              }}>{isPayLater ? "Create another payment link" : "Create another fee"}</Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
