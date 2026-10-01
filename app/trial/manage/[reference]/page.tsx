import type { Metadata } from "next";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { TrialManageForm } from "./TrialManageForm";

export const metadata: Metadata = { title: "無料体験予約の確認", robots: { index: false, follow: false } };

export default async function TrialManagePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ reference }, { token }] = await Promise.all([params, searchParams]);
  return <div className="page-shell"><SiteHeader /><main><header className="page-hero"><p className="eyebrow">MANAGE TRIAL</p><h1>無料体験の予約確認</h1><p>確認メールに記載された専用リンクから、日時変更とキャンセルができます。</p></header><div className="content-wrap"><TrialManageForm reference={reference} token={token ?? ""} /></div></main><SiteFooter /></div>;
}
