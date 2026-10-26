import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/contexts/UserContext";
import { adminHome, canAccessAdminScreen } from "@/lib/admin-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  DHL_LOCAL_IDS,
  dhlLocalService,
  type DHLLocalConfig,
  type DHLLocalDocument,
} from "@/services/dhl-local.service";

function LocalRates({
  document,
  onSaved,
  onReload,
}: {
  document: DHLLocalDocument;
  onSaved: (config: DHLLocalConfig) => void;
  onReload: () => void;
}) {
  const config = document.config!;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState(config.currency);
  const [weightUnit, setWeightUnit] = useState(config.weightUnit);
  const [rates, setRates] = useState(() =>
    config.rates.map((rate) => ({
      weight: String(rate.weight),
      amount: String(rate.amount),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrency(config.currency);
    setWeightUnit(config.weightUnit);
    setRates(
      config.rates.map((rate) => ({
        weight: String(rate.weight),
        amount: String(rate.amount),
      })),
    );
    setError(null);
    setEditing(false);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await dhlLocalService.updateDocument(
        document.id,
        {
          currency: currency.trim().toUpperCase(),
          weightUnit: weightUnit.trim(),
          rates: rates.map((rate) => ({
            weight: rate.weight.trim() ? Number(rate.weight) : NaN,
            amount: rate.amount.trim() ? Number(rate.amount) : NaN,
          })),
        },
        config,
      );
      onSaved(updated);
      setEditing(false);
      toast.success(`DHL Local ${document.id} rates updated`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save rates. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4" aria-busy={saving}>
      <fieldset disabled={saving} className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${document.id}-currency`}>Currency</Label>
            {editing ? (
              <Input
                id={`${document.id}-currency`}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                required
                maxLength={3}
                className="w-32"
              />
            ) : (
              <p className="font-medium">{config.currency}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${document.id}-unit`}>Weight unit</Label>
            {editing ? (
              <Input
                id={`${document.id}-unit`}
                value={weightUnit}
                onChange={(event) => setWeightUnit(event.target.value)}
                required
                className="w-32"
              />
            ) : (
              <p className="font-medium">{config.weightUnit}</p>
            )}
          </div>
          {!editing && (
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="outline" onClick={onReload}>
                Reload rates
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" />
                Edit rates
              </Button>
            </div>
          )}
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  Weight ({editing ? weightUnit : config.weightUnit})
                </TableHead>
                <TableHead>
                  Amount ({editing ? currency : config.currency})
                </TableHead>
                {editing && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(editing ? rates : config.rates).map((rate, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {editing ? (
                      <Input
                        aria-label={`Rate ${index + 1} weight`}
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={rate.weight}
                        onChange={(event) =>
                          setRates((previous) =>
                            previous.map((item, i) =>
                              i === index
                                ? { ...item, weight: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="min-w-28"
                      />
                    ) : (
                      rate.weight
                    )}
                  </TableCell>
                  <TableCell>
                    {editing ? (
                      <Input
                        aria-label={`Rate ${index + 1} amount`}
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={rate.amount}
                        onChange={(event) =>
                          setRates((previous) =>
                            previous.map((item, i) =>
                              i === index
                                ? { ...item, amount: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="min-w-36"
                      />
                    ) : (
                      Number(rate.amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 20,
                      })
                    )}
                  </TableCell>
                  {editing && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove rate ${index + 1}`}
                        disabled={rates.length <= 1}
                        onClick={() =>
                          setRates((previous) =>
                            previous.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {editing && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setRates((previous) => [
                  ...previous,
                  { weight: "", amount: "" },
                ])
              }
            >
              <Plus className="size-4" />
              Add rate
            </Button>
            <Button
              type="button"
              variant="outline"
              className="sm:ml-auto"
              onClick={reset}
            >
              Cancel
            </Button>
            <Button type="submit">{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

export default function DHLLocalPage() {
  const { user, loading: authLoading } = useCurrentUser();
  const allowed =
    user?.isAdmin === true &&
    canAccessAdminScreen(user.adminType, "/dhl-zones");
  const [documents, setDocuments] = useState<DHLLocalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState("abv");
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (authLoading || !allowed) return;
    let active = true;
    setLoading(true);
    setError(null);
    dhlLocalService
      .getDocuments()
      .then((result) => {
        if (active) setDocuments(result);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Failed to load DHL Local rates.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, authLoading, user?.id, revision]);

  if (!authLoading && !allowed)
    return <Navigate to={adminHome(user?.adminType)} replace />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">DHL Local</h1>
        <p className="text-muted-foreground">
          View and update local delivery rates by document.
        </p>
      </div>
      <Card aria-busy={loading}>
        <CardHeader>
          <CardTitle>Local rate configuration</CardTitle>
          <CardDescription>
            Select a document to manage its currency, weight unit, and rates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <>
              <p role="status" className="mb-4 text-sm text-muted-foreground">
                Loading DHL Local rates…
              </p>
              <Table>
                <TableBody>
                  <TableSkeleton columns={["w-28", "w-36"]} />
                </TableBody>
              </Table>
            </>
          ) : error ? (
            <div className="space-y-3">
              <p role="alert" className="text-destructive">
                {error}
              </p>
              <Button variant="outline" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : (
            <Tabs value={selectedDocument} onValueChange={setSelectedDocument}>
              <TabsList className="h-auto flex-wrap">
                {DHL_LOCAL_IDS.map((id) => (
                  <TabsTrigger key={id} value={id}>
                    {id}
                  </TabsTrigger>
                ))}
              </TabsList>
              {documents.map((document) => (
                <TabsContent
                  key={document.id}
                  value={document.id}
                  className="pt-4"
                >
                  {document.config ? (
                    <LocalRates
                      document={document}
                      onReload={reload}
                      onSaved={(config) =>
                        setDocuments((previous) =>
                          previous.map((item) =>
                            item.id === document.id
                              ? { id: item.id, config }
                              : item,
                          ),
                        )
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      <p role="alert" className="text-destructive">
                        {document.id}: {document.error}
                      </p>
                      <Button variant="outline" onClick={reload}>
                        Retry loading
                      </Button>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
