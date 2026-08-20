import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getRequestLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "TipMe", template: "%s | TipMe" },
  description: "Recibe tips de tus fans de forma rápida y verificable.",
  applicationName: "TipMe",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#171916" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
