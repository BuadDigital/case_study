import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { ToastRootProvider } from "@/providers/ToastRootProvider";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "نظام إجادة الداخلي",
  description: "تسجيل الدخول",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${arabic.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full font-sans antialiased"
        suppressHydrationWarning
      >
        <ToastRootProvider>{children}</ToastRootProvider>
      </body>
    </html>
  );
}
