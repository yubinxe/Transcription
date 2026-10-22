import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Toaster } from "@/components/ui/Toaster";

export const metadata: Metadata = {
  title: { default: "새벽기록 · DAWN ARCHIVE", template: "%s · 새벽기록" },
  description: "들은 말씀을, 오래 남는 문장으로. 영상 속의 말을 기록하고, 다시 읽고, 오래 생각하는 공간.",
  applicationName: "새벽기록",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F8F7F3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preload"
          href="/fonts/maruburi/MaruBuri-Regular-core.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/maruburi/MaruBuri-SemiBold-core.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/maruburi/maruburi.css" />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 bg-ink px-4 py-2 text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <main id="main" className="relative z-10">
          {children}
        </main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
