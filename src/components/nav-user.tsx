import { IconLogout } from "@tabler/icons-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function NavUser({
  user,
}: {
  user: { name: string; email: string; avatar: string };
}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  async function handleLogout() {
    setSigningOut(true);
    try {
      await signOut(auth);
      navigate("/sign-in");
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((name) => name[0])
      .join("")
      .toUpperCase() || "A";
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2">
      <Avatar className="size-9 border border-sidebar-border">
        <AvatarImage src={user.avatar} alt={user.name} />
        <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold">{user.name}</p>
        <p className="truncate text-xs text-sidebar-foreground/70">
          {user.email}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Sign out"
        title="Sign out"
        onClick={handleLogout}
        disabled={signingOut}
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <IconLogout size={18} />
      </Button>
    </div>
  );
}
