import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const clientEnvKeys = [
    "FIREBASE_BASE_URL",
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_APP_ID",
    "MEASUREMENT_ID",
    "MONO_SECRET_KEY",
    "CLERK_PUBLISHABLE_KEY",
  ];
  return {
    envPrefix: [],
    define: Object.fromEntries(
      clientEnvKeys.map((key) => [
        `import.meta.env.${key}`,
        JSON.stringify(env[key] ?? ""),
      ]),
    ),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
