import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "../../secure-page";
import { AdminCalendar } from "./AdminCalendar";

export const metadata: Metadata = { title: "予約カレンダー", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  await requireAdminPage("/admin/calendar");
  return <div className="dashboard-shell"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark">J</span><span>JUICY<small>RESERVATION CALENDAR</small></span></Link><nav className="dashboard-nav"><Link href="/admin">ダッシュボード</Link></nav></header><AdminCalendar /></div>;
}
