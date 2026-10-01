import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { DemoBanner } from "./components/DemoBanner";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: { default: "JUICY ギター教室｜好きな曲から始めるギターレッスン", template: "%s｜JUICY ギター教室" },
    description: "ギター教室の公式サイト・予約システムを紹介する制作実績用デモ。架空のデータで画面と予約の流れを試せます。",
    robots: { index: false, follow: false },
    openGraph: { title: "JUICY ギター教室", description: "好きな曲を、あなたの音に。制作実績用デモ。", type: "website", locale: "ja_JP", images: [{ url: imageUrl, width: 1536, height: 1024, alt: "JUICY ギター教室 初回無料体験受付中" }] },
    twitter: { card: "summary_large_image", title: "JUICY ギター教室", description: "好きな曲を、あなたの音に。初回無料体験受付中。", images: [imageUrl] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body><DemoBanner />{children}</body>
    </html>
  );
}
