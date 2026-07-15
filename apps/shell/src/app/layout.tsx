import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { ToastRootProvider } from "@/providers/ToastRootProvider";
import "./globals.css";

const arabic = Tajawal({
  weight: ["400", "500", "700", "800"],
  subsets: ["arabic", "latin"],
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('ejada_theme')==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body
        className="min-h-full font-sans antialiased"
        suppressHydrationWarning
      >
        <ToastRootProvider>{children}</ToastRootProvider>
      </body>
    </html>
  );
}
