import type { Metadata, Viewport } from "next";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arborist",
  description: "Field estimates for arborists",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#10b981",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-md min-h-screen pb-16">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
