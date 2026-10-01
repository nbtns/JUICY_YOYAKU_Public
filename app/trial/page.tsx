import type { Metadata } from "next";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { TrialForm } from "./TrialForm";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "初回無料体験予約" };

export default function TrialPage() {
  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <header className="page-hero"><p className="eyebrow">FREE TRIAL</p><h1>まずは、鳴らしてみよう。</h1><p>経験ゼロでも、楽器を持っていなくても大丈夫です。ご希望の日時と、弾いてみたい曲を教えてください。</p></header>
        <div className="content-wrap">
          <div className="panel" style={{ marginBottom: 32 }}>
            <h2>会場</h2><p><strong>{siteConfig.address}</strong></p><p>制作実績用の架空の会場です。実際の教室への申し込みは受け付けていません。</p><a className="text-link" href={siteConfig.mapUrl} >会場案内を見る →</a>
          </div>
          <TrialForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
