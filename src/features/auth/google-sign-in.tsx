import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { IconBrandGoogle } from "@tabler/icons-react";
type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (result: { credential: string }) => void;
    auto_select: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => void;
  cancel: () => void;
};
const identity = () =>
  (window as typeof window & { google?: { accounts: { id: GoogleIdentity } } })
    .google?.accounts.id;
let sdk: Promise<void> | undefined;
// GIS owns one configuration per page, including the challenge-bound nonce.
// A fresh challenge must start in a fresh document rather than overwrite it.
let initializedIdentity: GoogleIdentity | undefined;
function loadGoogle() {
  if (identity()) return Promise.resolve();
  if (!sdk)
    sdk = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      const timer = window.setTimeout(() => {
        script.remove();
        sdk = undefined;
        reject(new Error("Google sign-in did not load. Try again."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        sdk = undefined;
        reject(new Error("Google sign-in could not load. Try again."));
      };
      document.head.appendChild(script);
    });
  return sdk;
}
export function GoogleSignIn({
  onSuccess,
  disabled,
  onBusyChange,
}: {
  onSuccess: () => Promise<void>;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const pending = useRef<{ body: string; key: string }>();
  const active = useRef(true);
  const attempt = useRef(0);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    fetch("/api/auth/options", { cache: "no-store", signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (active.current) setClientId(data.googleClientId);
      })
      .catch(() => {});
    return () => {
      active.current = false;
      attempt.current++;
      controller.abort();
      identity()?.cancel();
    };
  }, []);
  async function finish() {
    if (lock.current || !pending.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await api("/v2/auth/admin/google", {
        method: "POST",
        body: pending.current.body,
        headers: { "Idempotency-Key": pending.current.key },
      });
      pending.current = undefined;
      localStorage.removeItem("pnd-refresh-started");
      await onSuccess();
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        failure.status >= 400 &&
        failure.status < 500 &&
        ![408, 429].includes(failure.status)
      )
        pending.current = undefined;
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Google sign-in failed. Try again.",
        );
    } finally {
      lock.current = false;
      if (active.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  async function start() {
    if (lock.current || disabled) return;
    if (initializedIdentity && initializedIdentity === identity()) {
      window.location.reload();
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setReady(false);
    const generation = ++attempt.current;
    try {
      let audience = clientId;
      if (!audience) {
        const response = await fetch("/api/auth/options", {
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error(
            "Google sign-in settings could not be loaded. Please try again.",
          );
        audience = (await response.json()).googleClientId;
        if (active.current) setClientId(audience);
      }
      if (!audience)
        throw new Error(
          "Google sign-in is not configured yet. Contact your administrator or sign in with email.",
        );
      if (!active.current || generation !== attempt.current) return;
      await loadGoogle();
      const challenge = await api("/v2/auth/social/challenges", {
        method: "POST",
        body: JSON.stringify({ provider: "google" }),
      });
      if (!active.current || generation !== attempt.current) return;
      if (
        !challenge.challengeId ||
        !challenge.nonce ||
        !Number.isFinite(Date.parse(challenge.expiresAt))
      )
        throw new Error("Google challenge is unavailable. Try again.");
      const google = identity();
      if (!google) throw new Error("Google sign-in did not load. Try again.");
      initializedIdentity = google;
      google.initialize({
        client_id: audience,
        nonce: challenge.nonce,
        auto_select: false,
        callback: (result) => {
          if (
            !active.current ||
            generation !== attempt.current ||
            pending.current ||
            lock.current
          )
            return;
          if (Date.now() >= Date.parse(challenge.expiresAt)) {
            setReady(false);
            setError("Google sign-in expired. Start again.");
            return;
          }
          pending.current = {
            body: JSON.stringify({
              challengeId: challenge.challengeId,
              idToken: result.credential,
            }),
            key: crypto.randomUUID(),
          };
          setReady(false);
          void finish();
        },
      });
      if (container.current)
        google.renderButton(container.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          // The container is hidden until ready; measure its visible parent.
          width: Math.min(
            container.current.parentElement?.clientWidth || 280,
            400,
          ),
        });
      setReady(true);
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not start Google sign-in.",
        );
    } finally {
      lock.current = false;
      if (active.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  return (
    <div className="space-y-4">
      <div className="relative" aria-hidden="true">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <div
        ref={container}
        className={ready && !disabled ? "min-h-11" : "hidden"}
      />
      {!ready && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-11"
          disabled={disabled || busy}
          onClick={pending.current ? finish : start}
        >
          <IconBrandGoogle className="mr-2 h-4 w-4" aria-hidden="true" />
          {busy
            ? "Connecting…"
            : pending.current
              ? "Retry Google sign-in"
              : "Continue with Google"}
        </Button>
      )}
      {ready && (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || busy}
          onClick={() => window.location.reload()}
        >
          Restart Google sign-in
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Use the Google account already linked to your administrator profile.
      </p>
    </div>
  );
}
