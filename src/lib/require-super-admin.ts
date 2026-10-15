import { auth } from "@/lib/firebase";

export async function requireSuperAdmin() {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in as a super admin to manage head offices");
  const { claims } = await user.getIdTokenResult();
  if (claims.isAdmin !== true || claims.adminType !== "super") {
    throw new Error("Super admin access is required");
  }
}
