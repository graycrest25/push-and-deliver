import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { onIdTokenChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isAdminType } from "@/lib/admin-access";
import { startAdminClaimsRefresh } from "@/lib/admin-claims-refresh";
import type { User } from "@/types";

interface UserContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  adminType?: "super" | "regular" | "customercare" | "verifier" | "";
  refetchUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  refetchUser: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const sessionUid = useRef<string | null>(null);
  const profileRequest = useRef(0);

  const fetchUserData = useCallback(async (uid: string) => {
    const request = ++profileRequest.current;
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== uid) return;
      const { claims } = await firebaseUser.getIdTokenResult();
      if (request !== profileRequest.current || auth.currentUser?.uid !== uid)
        return;
      if (claims.isAdmin !== true || !isAdminType(claims.adminType)) {
        setUser(null);
        return;
      }
      const adminType = claims.adminType;
      // Apply permissions immediately; profile reads must not delay a role change.
      setUser((previous) => ({
        ...(previous?.id === uid ? previous : {}),
        id: uid,
        email: firebaseUser.email || undefined,
        username: firebaseUser.displayName || undefined,
        imageURL: firebaseUser.photoURL || undefined,
        isAdmin: true,
        adminType,
      }));
      // Profile data enriches the session; token claims determine access.
      const userSnap = await getDoc(doc(db, "Users", uid)).catch(() => null);
      if (request !== profileRequest.current || auth.currentUser?.uid !== uid)
        return;
      const userData = userSnap?.exists() ? userSnap.data() : {};
      setUser({
        ...userData,
        id: uid,
        email: userData.email || firebaseUser.email,
        username: userData.username || firebaseUser.displayName,
        imageURL: userData.imageURL || firebaseUser.photoURL,
        isAdmin: true,
        adminType,
      } as User);
    } catch (error) {
      if (request !== profileRequest.current || auth.currentUser?.uid !== uid)
        return;
      console.error("Failed to load user profile:", error);
      setUser(null);
    }
  }, []);

  const refetchUser = useCallback(async () => {
    if (currentUid) {
      await auth.currentUser?.getIdToken(true);
      await fetchUserData(currentUid);
    }
  }, [currentUid, fetchUserData]);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (sessionUid.current !== (firebaseUser?.uid ?? null)) setLoading(true);
      sessionUid.current = firebaseUser?.uid ?? null;
      if (firebaseUser) {
        setCurrentUid(firebaseUser.uid);
        await fetchUserData(firebaseUser.uid);
      } else {
        setCurrentUid(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserData]);

  useEffect(
    () =>
      startAdminClaimsRefresh(async () => {
        await auth.currentUser?.getIdToken(true);
      }),
    [],
  );

  const isAdmin = user?.isAdmin === true;
  const adminType = user?.adminType;

  return (
    <UserContext.Provider
      value={{ user, loading, isAdmin, adminType, refetchUser }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useCurrentUser = () => useContext(UserContext);
