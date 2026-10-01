import type { Metadata } from "next";
import Link from "next/link";
import { demoSignOutPath } from "../demo-auth";
import { requireAdminPage } from "../secure-page";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = { title: "管理画面", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminPage("/admin");
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark">J</span><span>JUICY<small>ADMIN</small></span></Link><nav className="dashboard-nav" aria-label="管理画面メニュー"><Link href="/admin/calendar">予約カレンダー</Link><span className="dashboard-user">{user.displayName}</span><a href={demoSignOutPath()}>デモを終了</a></nav></header>
      <AdminDashboard />
    </div>
  );
}
