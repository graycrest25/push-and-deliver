import type { Metadata } from "next";
import "@/index.css";
export const metadata: Metadata = {
  title: "PushNDeliver · Admin workspace",
  description: "PushNDeliver operations workspace",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
