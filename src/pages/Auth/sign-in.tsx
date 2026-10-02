import { adminHome } from "@/lib/admin-access";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginAdminWithEmailAndPassword,
  loginAdminWithGoogle,
} from "@/services/admin-auth.service";
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
import { IconEye, IconEyeOff, IconBrandGoogle } from "@tabler/icons-react";

export default function SignInPage() {
  const navigate = useNavigate();
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
      const result = await loginAdminWithEmailAndPassword(
        email.trim(),
        password,
      );
      toast.success("Signed in successfully");
      navigate(adminHome(result.customClaims.adminType));
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loginAdminWithGoogle();

      toast.success("Signed in with Google successfully");
      navigate(adminHome(result.customClaims.adminType));
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to sign in with Google. Please try again.",
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full h-11"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <IconBrandGoogle className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
