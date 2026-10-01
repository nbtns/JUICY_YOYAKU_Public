import type { Metadata } from "next";
import Link from "next/link";
import { demoSignOutPath } from "../demo-auth";
import { requireMemberPage } from "../secure-page";
import { MemberDashboard } from "./MemberDashboard";

export const metadata: Metadata = { title: "会員ページ", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const returnTo = preview ? `/member?preview=${encodeURIComponent(preview)}` : "/member";
  const user = await requireMemberPage(returnTo);
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark">J</span><span>JUICY<small>MEMBER PAGE</small></span></Link><nav className="dashboard-nav" aria-label="会員メニュー">{user.isAdminPreview && <Link href="/admin#test-members">管理画面へ戻る</Link>}<span className="dashboard-user">{user.displayName}</span>{!user.isAdminPreview && <a href={demoSignOutPath()}>デモを終了</a>}</nav></header>
      <MemberDashboard adminPreview={user.isAdminPreview} previewStudentId={user.previewStudentId} previewStudentName={user.previewStudentName} />
    </div>
  );
}
