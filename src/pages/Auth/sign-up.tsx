import { AuthFrame } from "@/components/auth-frame";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function SignUpPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // 2. Update profile with display name
      await updateProfile(user, {
        displayName: username,
      });

      // 3. Create user document in Firestore
      await setDoc(doc(db, "Users", user.uid), {
        email: user.email,
        username: username,
        imageURL: "",
        id: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isAdmin: false, // Default to false
        adminType: "regular", // Default to regular
        walletbalance: 0,
        rewardpoints: 0,
        referralsCount: 0,
        deviceName: "Web",
        fcmtoken: "",
        phonenumber: "",
        referredBy: "",
        referralID: user.uid.slice(0, 6), // Simple referral ID generation
      });

      toast.success("Account created successfully");
      await auth.signOut();
      navigate("/sign-in");
    } catch (error: any) {
      console.error("Error signing up:", error);
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame>
      <Card className="auth-form-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Sign Up
          </CardTitle>
          <CardDescription className="text-center">
            Create an account to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="John Doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </AuthFrame>
  );
}
