import Link from "next/link";

export function DemoBanner() {
  return <aside className="demo-banner" aria-label="制作実績用デモの案内">
    <div><strong>PORTFOLIO DEMO</strong><span>架空のデータで操作できます。実際の予約・決済・メール送信は行いません。</span></div>
    <nav aria-label="デモ画面の切り替え"><Link href="/trial">体験予約</Link><a href="/demo?role=member">会員デモ</a><a href="/demo?role=admin">先生デモ</a></nav>
  </aside>;
}
