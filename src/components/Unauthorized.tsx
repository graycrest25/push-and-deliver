import { useState } from "react";
import { signOut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AuthFrame } from "@/components/auth-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/contexts/UserContext";
import { SecurityPage } from "@/features/admin/security";
export default function Unauthorized() {
  const { refetchUser, user } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await signOut();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign out failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <Card className="auth-form-card">
        <CardHeader>
          <CardTitle>
            <h1>
              {user?.membershipKnown
                ? "Administrator access required"
                : "Admin access cannot be verified yet"}
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {user?.membershipKnown
              ? "Your account does not have administrator access. Contact an administrator to request access."
              : "You are signed in, but this deployment did not return valid administrator membership. Contact your backend administrator to enable the updated session contract."}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await refetchUser();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retry access check
            </Button>
            <Button variant="outline" disabled={busy} onClick={logout}>
              Sign out
            </Button>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Manage your own session
            </summary>
            <div className="mt-4">
              <SecurityPage />
            </div>
          </details>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
