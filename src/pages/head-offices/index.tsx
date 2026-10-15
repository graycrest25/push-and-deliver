import { useState } from "react";
import { MapPin, Plus, Search, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/contexts/UserContext";
import { useHeadOffices } from "@/hooks/use-head-offices";
import { headOfficesService } from "@/services/head-offices.service";
import type { HeadOfficeAddress } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initialForm = {
  location: "",
  address: "",
  latitude: "",
  longitude: "",
  active: true,
};
export default function HeadOfficesPage() {
  const { adminType } = useCurrentUser();
  const { offices, loading, error, reload } = useHeadOffices();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<HeadOfficeAddress | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  if (adminType !== "super")
    return (
      <p className="p-6 text-muted-foreground">
        Super admin access is required to view head offices.
      </p>
    );

  const createOffice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    if (!form.latitude.trim() || !form.longitude.trim()) {
      setFormError("Enter both latitude and longitude.");
      return;
    }
    setBusy("create");
    try {
      await headOfficesService.create({
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      setCreateOpen(false);
      setForm(initialForm);
      reload();
      toast.success("Head office created");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create head office",
      );
    } finally {
      setBusy(null);
    }
  };
  const setActive = async (office: HeadOfficeAddress, active: boolean) => {
    if (busy) return;
    setBusy(office.id);
    try {
      await headOfficesService.setActive(office.id, active);
      reload();
      toast.success(
        active ? "Head office activated" : "Head office deactivated",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to change head office status",
      );
    } finally {
      setBusy(null);
    }
  };
  const deleteOffice = async () => {
    if (!deleting || busy) return;
    setBusy(deleting.id);
    try {
      await headOfficesService.delete(deleting.id);
      setDeleteOpen(false);
      reload();
      toast.success("Head office deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete head office",
      );
    } finally {
      setBusy(null);
    }
  };
  const filtered = offices.filter(
    (office) =>
      (status === "all" ||
        (status === "active" ? office.active : !office.active)) &&
      [office.location, office.address, office.id].some((value) =>
        value?.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Head offices
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage office locations, addresses, and availability.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(initialForm);
            setFormError("");
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          New head office
        </Button>
      </header>
      <section
        className="overflow-hidden rounded-xl border bg-card"
        aria-label="Head office directory"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Search head offices"
              className="pl-9"
              placeholder="Search location, address, or ID…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Office status filter"
          >
            {[
              ["all", "All offices"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ].map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={status === value ? "secondary" : "ghost"}
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            Loading head offices…
          </div>
        ) : error ? (
          <div role="alert" className="p-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button className="mt-3" variant="outline" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-3 size-7" />
            <p>
              {offices.length
                ? "No head offices match your filters."
                : "No head offices yet. Create one to get started."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((office) => (
              <article
                key={office.id}
                className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6"
              >
                <div className="flex min-w-0 flex-1 basis-full items-start gap-3 sm:basis-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <MapPin className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words font-semibold">
                        {office.location || "Unnamed office"}
                      </h2>
                      <Badge variant={office.active ? "secondary" : "outline"}>
                        {office.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-muted-foreground">
                      {office.address || "No address recorded"}
                    </p>
                    <p className="mt-3 break-all text-xs text-muted-foreground">
                      Document ID:{" "}
                      <span className="font-mono">{office.id}</span>
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {office.geolocation
                        ? `${office.geolocation.latitude.toFixed(6)}, ${office.geolocation.longitude.toFixed(6)}`
                        : "No coordinates recorded"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${office.id}`} className="text-sm">
                      Active
                    </Label>
                    <Switch
                      id={`active-${office.id}`}
                      checked={office.active === true}
                      disabled={busy !== null}
                      onCheckedChange={(active) => setActive(office, active)}
                      aria-label={`Set ${office.location} active`}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete ${office.location} head office`}
                    disabled={busy !== null}
                    onClick={() => {
                      setDeleting(office);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && (
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            {filtered.length} of {offices.length} offices · Super admin access
            only
          </p>
        )}
      </section>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!busy) setCreateOpen(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New head office</DialogTitle>
            <DialogDescription>
              Add the location, full address, and geographic coordinates.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createOffice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="office-location">Location</Label>
              <Input
                id="office-location"
                required
                value={form.location}
                placeholder="e.g. Ibadan"
                onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
                }
                disabled={busy !== null}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-address">Full address</Label>
              <Input
                id="office-address"
                required
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                disabled={busy !== null}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ["latitude", "Latitude", -90, 90],
                  ["longitude", "Longitude", -180, 180],
                ] as const
              ).map(([key, label, min, max]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`office-${key}`}>{label}</Label>
                  <Input
                    id={`office-${key}`}
                    type="number"
                    step="any"
                    min={min}
                    max={max}
                    required
                    value={form[key]}
                    onChange={(event) =>
                      setForm({ ...form, [key]: event.target.value })
                    }
                    disabled={busy !== null}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Use decimal degrees. North and east are positive; south and west
              are negative.
            </p>
            <div className="flex items-center gap-2">
              <Switch
                id="new-office-active"
                checked={form.active}
                onCheckedChange={(active) => setForm({ ...form, active })}
                disabled={busy !== null}
              />
              <Label htmlFor="new-office-active">Active</Label>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={busy !== null}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy !== null}>
                {busy === "create" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Create head office
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!busy) setDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.location} head office?</DialogTitle>
            <DialogDescription>
              This permanently deletes the office. Existing shipments keep their
              office document ID, but this location’s name and address will no
              longer be available from the directory. Deactivate the office
              instead to preserve it.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {deleting?.id}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteOffice}
              disabled={busy !== null}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}Delete head
              office
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
