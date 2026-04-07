"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  generatedReferralsService,
  type GeneratedReferral,
} from "@/services/generated-referrals.service";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "recharts";
import { Trash2, RefreshCcw, Loader2 } from "lucide-react";

const getToken = async () => {
  const user = auth.currentUser;

  if (!user) throw new Error("Not authenticated");

  return await user.getIdToken();
};

const createReferral = async (name: string) => {
  try {
    const token = await getToken();

    const res = await fetch(import.meta.env.VITE_REFERRAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) throw new Error("Failed to create referral");

    const data = await res.json();

    toast.success("Referral created!");
    return data;
  } catch (error) {
    console.error(error);
    toast.error("Failed to create referral");
  }
};

export default function GeneratedReferralsPage() {
  const [referrals, setReferrals] = useState<GeneratedReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreateReferral = async () => {
    try {
      setCreating(true);

      await createReferral(name); // your API function from earlier

      toast.success("Referral created!");
      setOpen(false);
      setName("");

      loadReferrals(); // refresh table 🔥
    } catch (error) {
      toast.error("Failed to create referral");
    } finally {
      setCreating(false);
    }
  };
  const handleRegenerate = async (ref: GeneratedReferral) => {
    if (!ref.name) return;

    try {
      setRegeneratingId(ref.id);

      await createReferral(ref.name);

      toast.success("Referral link regenerated!");
      loadReferrals();
    } catch (error) {
      toast.error("Failed to regenerate link");
    } finally {
      setRegeneratingId(null);
    }
  };
  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);

      await generatedReferralsService.deleteReferral(id);

      toast.success("Referral deleted!");

      // Update UI instantly (better than reload 🔥)
      setReferrals((prev) => prev.filter((ref) => ref.id !== id));
    } catch (error) {
      toast.error("Failed to delete referral");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    try {
      setLoading(true);
      const data = await generatedReferralsService.getAllGeneratedReferrals();
      setReferrals(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load generated referrals");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (url?: string) => {
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return "N/A";
    return date.toLocaleDateString();
  };

  const isExpired = (date?: Date) => {
    if (!date) return false;
    return date < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Generated Referrals</h1>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Create Referral</Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Referral</DialogTitle>
              <DialogDescription>
                Enter a name to generate a new referral link
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Sylvester Campaign"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <Button
                onClick={handleCreateReferral}
                disabled={creating || !name.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Referrals</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : referrals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No generated referrals found
                </TableCell>
              </TableRow>
            ) : (
              referrals.map((ref) => (
                <TableRow key={ref.id}>
                  <TableCell className="font-medium">
                    {ref.name || "N/A"}
                  </TableCell>

                  <TableCell>
                    {ref.shortUrl ? (
                      <div className="flex items-center gap-2">
                        {/* Open Link */}
                        {ref.shortUrl}
                        {/* <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(ref.shortUrl, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Open
                        </Button> */}

                        {/* Copy Link */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(ref.shortUrl)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline">{ref.referralsCount || 0}</Badge>
                  </TableCell>

                  <TableCell>{formatDate(ref.createdAt)}</TableCell>

                  <TableCell>{formatDate(ref.expirationDate)}</TableCell>

                  <TableCell>
                    {isExpired(ref.expirationDate) ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>

                  <TableCell>{formatDate(ref.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Delete */}
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(ref.id)}
                        disabled={deletingId === ref.id}
                      >
                        {deletingId === ref.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>

                      {/* Regenerate */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleRegenerate(ref)}
                        disabled={regeneratingId === ref.id}
                      >
                        {regeneratingId === ref.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
