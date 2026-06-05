import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Save with Friends · Ahorra con Amigos",
  description:
    "Social savings on Celo — lock funds in a Vault toward a goal, save with friends.",
};

// Mobile-first: MiniPay renders at ~360×640. Lock the viewport to device width.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-100">
        {/* Centered mobile frame so the app reads as a phone screen on desktop too.
            Soft emerald gradient + blurred glows give the frosted-glass surfaces
            (tab bar, cards) something to blur, for the futuristic look. */}
        <div className="relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col overflow-hidden bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/70">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 left-1/2 h-60 w-72 -translate-x-1/2 rounded-full bg-emerald-400/25 blur-3xl"
          />
          <LanguageProvider>{children}</LanguageProvider>
        </div>
      </body>
    </html>
  );
}
