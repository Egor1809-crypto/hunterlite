import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import { Providers } from "@/components/providers/Providers";
import CookieBanner from "@/components/legal/CookieBanner";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Display-serif для «момента» (футер-кейноут, крупные заголовки-бренд).
// next/font self-hosts на билде — рантайм-запроса к Google нет.
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "LegalHunter — AI-тренажёр для арбитражных управляющих",
  description: "AI-платформа обучения арбитражных управляющих через диалоговые симуляции с AI-клиентами",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-512.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "LegalHunter — AI-тренажёр для арбитражных управляющих",
    description: "AI-тренажёр для арбитражных управляющих. Реалистичные AI-клиенты, мгновенный фидбек.",
    type: "website",
    siteName: "LegalHunter",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary_large_image",
    title: "LegalHunter — AI-тренажёр для арбитражных управляющих",
    description: "AI-тренажёр для арбитражных управляющих. Реалистичные AI-клиенты.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LegalHunter",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
    { media: "(prefers-color-scheme: light)", color: "#FAFBFC" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // 2026-06-15: opt into the notch — без этого env(safe-area-inset-*),
  // которым пользуются панели чата/звонка/квиза, получает нули на iPhone
  // с челкой в standalone-режиме (PWA).
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="ru" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta property="csp-nonce" content={nonce} />
        <style nonce={nonce} suppressHydrationWarning>{`
          ::view-transition-old(root) {
            animation: fade-out 0.15s ease-in;
          }
          ::view-transition-new(root) {
            animation: fade-in 0.15s ease-out;
          }
          @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
          @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} min-h-screen antialiased`}>
        <ViewTransitions>
          <Providers>
            {children}
            <CookieBanner />
          </Providers>
        </ViewTransitions>
      </body>
    </html>
  );
}
