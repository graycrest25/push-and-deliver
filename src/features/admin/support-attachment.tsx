import { useEffect, useRef, useState } from "react";
import { api, ApiError, segment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SupportAttachment({
  assetId,
  contentType,
}: {
  assetId: string;
  contentType: string;
}) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const imageRetried = useRef(false);
  const isImage = contentType.toLowerCase().startsWith("image/");

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let expiresAt = Infinity;
    let loading = false;
    async function resolve() {
      if (loading || controller.signal.aborted) return;
      loading = true;
      clearTimeout(timer);
      setUrl(undefined);
      setError(undefined);
      try {
        // api unwraps data and uses the authenticated admin-session proxy.
        const result = await api(`/v1/assets/${segment(assetId)}/download`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const next = new URL(result.downloadUrl);
        if (!["https:", "http:"].includes(next.protocol)) throw new Error();
        const expiry = Date.parse(result.expiresAt || "");
        expiresAt = Number.isFinite(expiry) ? expiry : Infinity;
        if (expiresAt <= Date.now()) throw new Error();
        setUrl(next.href);
        if (Number.isFinite(expiresAt)) {
          timer = setTimeout(
            () => void resolve(),
            Math.min(expiresAt - Date.now(), 2147483647),
          );
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(
            failure instanceof ApiError &&
              [403, 404, 410].includes(failure.status)
              ? "Attachment unavailable"
              : "Could not load attachment. Please retry.",
          );
        }
      } finally {
        loading = false;
      }
    }
    const refreshExpired = () => {
      if (document.visibilityState === "visible" && Date.now() >= expiresAt)
        void resolve();
    };
    void resolve();
    window.addEventListener("focus", refreshExpired);
    document.addEventListener("visibilitychange", refreshExpired);
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("focus", refreshExpired);
      document.removeEventListener("visibilitychange", refreshExpired);
    };
  }, [assetId, revision]);

  function imageFailed() {
    // Expiry may be absent or a signed URL may be revoked early. Retry once,
    // then require an explicit retry so a corrupt image cannot loop requests.
    if (!imageRetried.current) {
      imageRetried.current = true;
      setRevision((value) => value + 1);
    } else {
      setUrl(undefined);
      setError("Could not load image. Please retry.");
    }
  }
  const status = error ? (
    <div className="space-y-2" role="status">
      <p className="text-xs">{error}</p>
      {error !== "Attachment unavailable" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            imageRetried.current = false;
            setRevision((value) => value + 1);
          }}
        >
          Retry attachment
        </Button>
      )}
    </div>
  ) : (
    <p className="text-xs" role="status">
      Loading attachment…
    </p>
  );

  if (!isImage)
    return url ? (
      <a
        className="text-sm underline underline-offset-4"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        Download attachment
      </a>
    ) : (
      status
    );

  return (
    <Dialog>
      {url ? (
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Enlarge attached image"
            className="block max-w-full overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <img
              src={url}
              alt="Customer attachment"
              referrerPolicy="no-referrer"
              className="max-h-64 max-w-full object-contain"
              onError={imageFailed}
            />
            <span className="block px-3 py-2 text-xs underline underline-offset-4">
              Click to enlarge
            </span>
          </button>
        </DialogTrigger>
      ) : (
        status
      )}
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Attached image</DialogTitle>
          <DialogDescription>
            Customer-uploaded support ticket image.
          </DialogDescription>
        </DialogHeader>
        {url ? (
          <img
            src={url}
            alt="Customer attachment enlarged"
            referrerPolicy="no-referrer"
            className="max-h-[75dvh] w-full object-contain"
            onError={imageFailed}
          />
        ) : (
          status
        )}
      </DialogContent>
    </Dialog>
  );
}
