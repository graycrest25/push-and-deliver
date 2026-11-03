import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { api, ApiError } from "@/lib/api";
import { isAdminType, type AdminType } from "@/lib/admin-access";
export interface SessionUser {
  id: string;
  email: string;
  username: string;
  imageURL?: string;
  isAdmin: boolean;
  membershipKnown?: boolean;
  adminType?: AdminType;
}
const UserContext = createContext<{
  user: SessionUser | null;
  loading: boolean;
  error: string;
  isAdmin: boolean;
  adminType?: AdminType;
  refetchUser: () => Promise<boolean>;
}>({
  user: null,
  loading: true,
  error: "",
  isAdmin: false,
  refetchUser: async () => false,
});
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const refetchUser = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const session = await api("/v2/auth/session");
      if (
        session.accountType !== "user" ||
        !session.uid ||
        session.accountStatus !== "active"
      )
        throw new Error(
          "An active user-context session is required for the admin workspace.",
        );
      const profile = await api("/v1/users/me");
      if (profile.uid !== session.uid || profile.accountType !== "user")
        throw new Error("The profile does not match your session.");
      if (request !== generation.current) return false;
      // Membership comes only from the authoritative session contract.
      const membershipKnown =
        (session.isAdmin === true && isAdminType(session.adminType)) ||
        (session.isAdmin === false && session.adminType === null);
      setUser({
        id: session.uid,
        email: profile.email || "",
        username: profile.username || profile.email || session.uid,
        isAdmin: membershipKnown && session.isAdmin === true,
        membershipKnown,
        adminType:
          membershipKnown && session.isAdmin ? session.adminType : undefined,
      });
      return true;
    } catch (failure) {
      if (request !== generation.current) return false;
      if (failure instanceof ApiError && failure.status === 401) setUser(null);
      else
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to load your session. Please retry.",
        );
      return false;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refetchUser();
    const expired = () => {
      generation.current++;
      setError("");
      setUser(null);
      setLoading(false);
    };
    const changed = () => {
      void refetchUser();
    };
    window.addEventListener("session-expired", expired);
    window.addEventListener("session-changed", changed);
    return () => {
      generation.current++;
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("session-changed", changed);
    };
  }, [refetchUser]);
  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        isAdmin: user?.isAdmin === true,
        adminType: user?.adminType,
        refetchUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
export const useCurrentUser = () => useContext(UserContext);
