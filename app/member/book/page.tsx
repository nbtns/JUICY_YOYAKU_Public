import type { Metadata } from "next";
import Link from "next/link";
import { MemberBookingForm } from "./MemberBookingForm";
import { requireMemberPage } from "../../secure-page";

export const metadata: Metadata = { title: "レッスン予約", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MemberBookingPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const returnTo = preview ? `/member/book?preview=${encodeURIComponent(preview)}` : "/member/book";
  const user = await requireMemberPage(returnTo);
  const memberPath = user.previewStudentId ? `/member?preview=${encodeURIComponent(user.previewStudentId)}` : "/member";
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/"><span className="brand-mark">J</span><span>JUICY<small>LESSON BOOKING</small></span></Link>
        <nav className="dashboard-nav" aria-label="会員メニュー"><Link href={memberPath}>マイページ</Link>{user.isAdminPreview && <Link href="/admin#test-members">管理画面へ戻る</Link>}<span className="dashboard-user">{user.displayName}</span></nav>
      </header>
      <main className="dashboard-main">
        <p className="notice" style={{ marginBottom: 24 }}>{user.isAdminPreview ? `先生用プレビュー：${user.previewStudentName}さんとして予約画面を確認しています。` : "会員専用のレッスン予約ページです。無料体験の申し込みとは別のページです。"}</p>
        <Link className="dashboard-back" href={memberPath}>← 会員ページへ戻る</Link>
        <div className="dashboard-title member-booking-title"><div><p className="eyebrow">BOOK A LESSON</p><h1>レッスンを予約する</h1><p>空いている日時を選ぶと、今月の残り回数から1回分を確保します。</p></div></div>
        <MemberBookingForm previewStudentId={user.previewStudentId} />
      </main>
    </div>
  );
}
