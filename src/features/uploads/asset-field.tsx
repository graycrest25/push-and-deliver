import { createContext, useContext, useEffect, useRef, useState } from "react";
import { IconFile, IconUpload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/contexts/UserContext";
import { api, segment } from "@/lib/api";
import {
  discardUpload,
  FILE_TYPES,
  IMAGE_TYPES,
  prepareUpload,
  runUpload,
  uploadLimit,
  uploadImagesOnly,
  type UploadPurpose,
  type UploadDraft,
  type UploadProgress,
} from "@/lib/uploads";

export const UploadFormContext = createContext({
  scope: "",
  vendorId: "",
  committed: 0,
  hasDrafts: false,
  track: (_id: string, _pending: boolean, _drafts: boolean) => {},
});
type Entry = {
  draft: UploadDraft;
  ready?: boolean;
  error?: string;
  progress?: UploadProgress;
};
export function AssetField({
  id,
  path,
  label,
  value,
  change,
  multiple,
  imagesOnly,
  required,
  vendorOwned,
  ownAsset,
  purpose,
}: {
  id: string;
  path: string;
  label: string;
  value: string | string[];
  change: (value: string | string[]) => void;
  multiple?: boolean;
  imagesOnly?: boolean;
  required?: boolean;
  vendorOwned?: boolean;
  ownAsset?: boolean;
  purpose?: UploadPurpose;
}) {
  const { user } = useCurrentUser();
  const form = useContext(UploadFormContext);
  const canUpload =
    !!purpose && (!vendorOwned || (!!user?.id && user.id === form.vendorId));
  imagesOnly = imagesOnly || (!!purpose && uploadImagesOnly(purpose));
  const storageKey = `pnd-upload:${user?.id}:${form.scope}:${path}`;
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const drafts = JSON.parse(
        sessionStorage.getItem(storageKey) || "[]",
      ) as UploadDraft[];
      return drafts.map((draft) => ({
        draft,
        error:
          "Upload saved. Resume to check its status, or select the original file if needed.",
      }));
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState("");
  const entryRef = useRef(entries);
  const files = useRef(new Map<string, File>());
  const controller = useRef<AbortController>();
  const locked = useRef(false);
  const callbacks = useRef({ change, value });
  callbacks.current = { change, value };
  const mounted = useRef(true);
  const commit = useRef(form.committed);
  const ids = (v: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []);
  const currentIds = ids(value);
  function write(next: Entry[]) {
    entryRef.current = next;
    if (mounted.current) setEntries(next);
    if (mounted.current)
      form.track(
        id,
        locked.current || next.some((e) => !e.ready),
        next.length > 0,
      );
    if (next.length)
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(next.map((e) => e.draft)),
      );
    else sessionStorage.removeItem(storageKey);
  }
  function patch(key: string, data: Partial<Entry>) {
    write(
      entryRef.current.map((e) =>
        e.draft.key === key ? { ...e, ...data } : e,
      ),
    );
  }
  function attach(assetId: string) {
    const list = ids(callbacks.current.value);
    callbacks.current.change(
      multiple ? [...new Set([...list, assetId])] : assetId,
    );
  }
  function detach(assetId: string) {
    const list = ids(callbacks.current.value).filter((v) => v !== assetId);
    callbacks.current.change(multiple ? list : list[0] || "");
  }
  useEffect(() => {
    mounted.current = true;
    form.track(
      id,
      entries.some((e) => !e.ready),
      entries.length > 0,
    );
    return () => {
      mounted.current = false;
      controller.current?.abort();
      form.track(id, false, false);
    };
    // The field is mounted for one actor, form and row. Drafts survive navigation in this tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, form.track]);
  useEffect(() => {
    if (commit.current !== form.committed) {
      commit.current = form.committed;
      files.current.clear();
      write([]); // Successful parent mutation attached these assets. They are no longer deletable drafts.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.committed]);
  async function work(task: (signal: AbortSignal) => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    form.track(id, true, entryRef.current.length > 0);
    const abort = new AbortController();
    controller.current = abort;
    try {
      await task(abort.signal);
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Upload failed. Please retry.",
        );
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        form.track(
          id,
          entryRef.current.some((e) => !e.ready),
          entryRef.current.length > 0,
        );
      }
    }
  }
  async function resume(entry: Entry, signal: AbortSignal, file?: File) {
    try {
      patch(entry.draft.key, {
        error: undefined,
        progress: { message: "Checking upload…", percent: 0 },
      });
      const asset = await runUpload(
        entry.draft,
        file || files.current.get(entry.draft.key),
        signal,
        (draft) => patch(entry.draft.key, { draft }),
        (progress) => {
          if (mounted.current)
            setEntries((current) =>
              current.map((e) =>
                e.draft.key === entry.draft.key ? { ...e, progress } : e,
              ),
            );
        },
      );
      signal.throwIfAborted();
      patch(entry.draft.key, {
        ready: true,
        error: undefined,
        progress: { message: "File ready", percent: 100 },
      });
      attach(asset.id);
    } catch (e) {
      if (!signal.aborted)
        patch(entry.draft.key, {
          error:
            e instanceof Error ? e.message : "Upload paused. Please resume.",
        });
      else if (mounted.current)
        patch(entry.draft.key, {
          error: "Upload paused. Resume or discard it.",
        });
    }
  }
  function selectFile(file: File | undefined, entry?: Entry) {
    if (!file) return;
    void work(async (signal) => {
      if (entry) {
        files.current.set(entry.draft.key, file);
        await resume(entry, signal, file);
        return;
      }
      const draft = await prepareUpload(file, !!imagesOnly, purpose);
      signal.throwIfAborted();
      const next = { draft };
      write([...entryRef.current, next]); // Creation key is durable before the first request.
      files.current.set(draft.key, file);
      await resume(next, signal, file);
    });
  }
  const attachedExisting = currentIds.filter(
    (assetId) => !entries.some((e) => e.draft.assetId === assetId),
  );
  return (
    <div
      className="col-span-full space-y-3"
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {imagesOnly ? "JPEG, PNG or WebP" : "JPEG, PNG, WebP or PDF"} · Up to{" "}
        {purpose ? uploadLimit(purpose) / 1024 / 1024 : 10}
        MiB per file. Files must finish validation before you can save.
      </p>
      {!canUpload && (
        <p className="text-sm text-muted-foreground">
          This destination does not yet have a supported native attachment
          contract. Uploading on behalf of another account is unavailable.
        </p>
      )}
      {canUpload && (multiple || (!currentIds.length && !entries.length)) && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4">
          <IconUpload
            size={20}
            className="shrink-0 text-primary"
            aria-hidden="true"
          />
          <Input
            id={id}
            type="file"
            className="min-w-0"
            aria-describedby={`${id}-help`}
            accept={(imagesOnly ? IMAGE_TYPES : FILE_TYPES).join(",")}
            disabled={busy}
            onChange={(e) => {
              selectFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {attachedExisting.map((assetId) => (
        <div
          key={assetId}
          className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
        >
          <span className="min-w-0 break-all">Attached file · {assetId}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => detach(assetId)}
          >
            Remove from form
          </Button>
        </div>
      ))}
      {entries.map((entry) => (
        <div key={entry.draft.key} className="space-y-2 border-b py-3">
          <div className="flex items-start gap-2 text-sm">
            <IconFile
              size={18}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">{entry.draft.name}</p>
              <p className="text-xs text-muted-foreground">
                {entry.draft.size < 1024 * 1024
                  ? `${Math.max(1, Math.round(entry.draft.size / 1024))} KiB`
                  : `${(entry.draft.size / 1024 / 1024).toFixed(2)} MiB`}
              </p>
            </div>
            {entry.ready && (
              <span className="text-xs font-medium text-primary">
                File ready
              </span>
            )}
          </div>
          {!entry.ready && entry.progress && (
            <div
              role="status"
              className="space-y-1 text-xs text-muted-foreground"
            >
              <p>{entry.progress.message}</p>
              <progress
                className="h-1.5 w-full accent-primary"
                max={100}
                value={entry.progress.percent}
                aria-label={`Upload progress for ${entry.draft.name}`}
              />
            </div>
          )}
          {entry.error && (
            <p role="alert" className="text-sm text-destructive">
              {entry.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {!entry.ready && !busy && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void work((signal) => resume(entry, signal))}
                >
                  Resume upload
                </Button>
                {canUpload && (
                  <div className="w-full space-y-2">
                    <Label htmlFor={`${id}-${entry.draft.key}`}>
                      Select original file to resume
                    </Label>
                    <Input
                      id={`${id}-${entry.draft.key}`}
                      type="file"
                      accept={(imagesOnly ? IMAGE_TYPES : FILE_TYPES).join(",")}
                      onChange={(e) => {
                        selectFile(e.target.files?.[0], entry);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </>
            )}
            {busy && !entry.ready && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => controller.current?.abort()}
              >
                Pause upload
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void work(async (signal) => {
                  await discardUpload(entry.draft, signal, (draft) =>
                    patch(entry.draft.key, { draft }),
                  );
                  if (entry.draft.assetId) detach(entry.draft.assetId);
                  files.current.delete(entry.draft.key);
                  write(
                    entryRef.current.filter(
                      (e) => e.draft.key !== entry.draft.key,
                    ),
                  );
                })
              }
            >
              {entry.ready ? "Delete unattached file" : "Discard upload"}
            </Button>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
