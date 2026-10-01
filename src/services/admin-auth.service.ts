import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";
import type { User } from "@/types";

export interface AdminLoginResponse {
  success: true;
  uid: string;
  email: string;
  token: string;
  idtoken: string;
  refreshToken: string;
  expiresIn: number;
  customClaims: { isAdmin: true; adminType: NonNullable<User["adminType"]> };
}

async function login(endpoint: string, options: RequestInit): Promise<AdminLoginResponse> {
  const response = await fetch(endpoint, { ...options, method: "POST" });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    throw new Error(
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      "Admin sign-in failed. Please check your credentials and access.",
    );
  }
  if (typeof data.token !== "string" || !data.token ||
      typeof data.uid !== "string" || !data.uid ||
      data.customClaims?.isAdmin !== true ||
      !["super", "regular", "customercare", "verifier"].includes(data.customClaims?.adminType)) {
    throw new Error("The server returned an invalid admin login response.");
  }

  // Firebase manages session persistence and ID token refresh after this exchange.
  await signInWithCustomToken(auth, data.token);
  return data as AdminLoginResponse;
}

export function loginAdminWithEmailAndPassword(email: string, password: string) {
  return login(endpoints.loginAdminWithEmailAndPassword, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function loginAdminWithGoogle() {
  // Keep the preliminary Google session separate from the dashboard session.
  const appName = "admin-google-login";
  const googleApp = getApps().some((app) => app.name === appName)
    ? getApp(appName)
    : initializeApp(auth.app.options, appName);
  const googleAuth = getAuth(googleApp);
  await setPersistence(googleAuth, inMemoryPersistence);
  try {
    const result = await signInWithPopup(googleAuth, new GoogleAuthProvider());
    const idToken = await result.user.getIdToken();
    return await login(endpoints.loginAdminWithGoogle, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } finally {
    await signOut(googleAuth);
  }
}
