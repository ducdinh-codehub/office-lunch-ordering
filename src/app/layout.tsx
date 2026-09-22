import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { viVN } from "@clerk/localizations";

import { Toaster } from "@/components/ui/sonner";
import { APP_NAME } from "@/lib/app-name";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Đặt đồ ăn, thanh toán và xem ai còn nợ.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      localization={viVN}
      appearance={{
        // The yellow "Development mode" ribbon is a reminder for the developer,
        // not something the office needs to read every morning. It disappears on
        // its own once this points at a Clerk production instance.
        options: { unsafe_disableDevelopmentModeWarnings: true },
      }}
    >
      {/* The font variables live on <html> because globals.css applies `font-sans`
          there; putting them on <body> would leave the root without a font. */}
      <html lang="vi" className={`${geistSans.variable} ${geistMono.variable}`}>
        <body className="antialiased">
          {children}
          <Toaster position="top-center" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
