import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AHME",
  description: "AHME - AI-Human Mixed Editor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ★ 修正：Monaco Editor の CDN 倉庫 (cdn.jsdelivr.net) を安全リストに追加 */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file: app: http://localhost:* https://cdn.jsdelivr.net; connect-src 'self' ws: wss: http://localhost:* https://api.tavily.com https://cdn.jsdelivr.net; img-src 'self' data: blob: file: app: http://localhost:*; font-src 'self' data: file: app: https://cdn.jsdelivr.net;"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
