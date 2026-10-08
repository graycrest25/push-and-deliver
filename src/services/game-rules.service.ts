import { doc, getDocFromServer, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { parseGameRules, type TenSecondsRules } from "@/lib/ten-seconds-rules";

async function requireGameRulesAdmin() {
  if (!auth.currentUser) throw new Error("Sign in to manage game rules.");
  const { claims } = await auth.currentUser.getIdTokenResult();
  if (
    claims.isAdmin !== true ||
    !["super", "regular"].includes(String(claims.adminType))
  ) {
    throw new Error(
      "Super or regular admin access is required to manage game rules.",
    );
  }
}

export const gameRulesService = {
  async getTenSeconds(): Promise<TenSecondsRules | null> {
    await requireGameRulesAdmin();
    const snapshot = await getDocFromServer(doc(db, "gameRules", "tenSeconds"));
    return snapshot.exists() ? parseGameRules(snapshot.data()) : null;
  },

  async saveTenSeconds(rules: TenSecondsRules): Promise<TenSecondsRules> {
    await requireGameRulesAdmin();
    const validated = parseGameRules(rules);
    // Merge the known settings so unrelated document fields are preserved.
    await setDoc(doc(db, "gameRules", "tenSeconds"), validated, {
      merge: true,
    });
    return validated;
  },
};
