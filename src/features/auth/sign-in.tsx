import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { AuthFrame } from "@/components/auth-frame";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

import { GoogleSignIn } from "./google-sign-in";
export default function SignInPage() {
  const navigate = useNavigate();
  const { refetchUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api("/v2/auth/login", {
        method: "POST",
        body: JSON.stringify({
          accountType: "user",
          email: email.trim(),
          password,
        }),
      });
      localStorage.removeItem("pnd-refresh-started");
      if (!(await refetchUser()))
        throw new Error(
          "Signed in, but your session could not be loaded. Retry the session check.",
        );
      toast.success("Signed in successfully");
      navigate("/dashboard");
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame>
      <Card className="auth-form-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-sm">
            Sign in to your admin workspace to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="username"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={loading}
                  className="pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </Button>
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <GoogleSignIn
            disabled={loading}
            onBusyChange={setLoading}
            onSuccess={async () => {
              if (!(await refetchUser()))
                throw new Error(
                  "Signed in, but the session could not be loaded. Retry the session check.",
                );
              navigate("/dashboard");
            }}
          />

          <p className="text-sm text-muted-foreground">
            Access is managed by your administrator. Contact them if you need an
            admin account.
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
