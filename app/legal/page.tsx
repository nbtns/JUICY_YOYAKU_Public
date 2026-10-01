import type { Metadata } from "next";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";

export const metadata: Metadata = { title: "規約・法的表記" };

export default function LegalPage() {
  return <div className="page-shell"><SiteHeader /><main><header className="page-hero"><p className="eyebrow">POLICIES</p><h1>安心して通うために。</h1><p>制作実績用のサンプルです。実際の申込・契約・課金は行いません。</p></header><div className="content-wrap legal-copy">
    <section id="policy"><h2>キャンセル・振替規約</h2><h3>生徒都合のキャンセル</h3><p>キャンセルのご連絡をいただいた場合は、レッスン開始時刻の24時間前以降でも、予約に確保した1回分を返却します。無断キャンセルの場合のみ、1回分を受講済みとして扱います。</p><h3>教室都合の休講</h3><p>回数を返却し、通常回数とは別に翌月末まで使える振替1回分を発行します。</p><h3>予約時間</h3><p>レッスンは60分です。予約は1時間刻みで、前後の休憩時間は設けていません。</p></section>
    <section><h2>休会・退会・コース変更</h2><p>毎月21日午前8:59までの申請は翌月から反映します。21日午前9:00以降の申請は、原則として翌々月から反映します。通常の未使用回数は月末で失効し、翌月へ繰り越しません。</p></section>
    <section id="privacy"><h2>デモのデータについて</h2><p>入力内容はこのフォルダ内のローカルデモDBに保存されます。架空の氏名・生年月日・連絡先だけを使ってください。外部へのメール送信は行いません。</p></section>
    <section id="commerce"><h2>サンプル表記</h2><p>このデモでは商品・サービスを販売しません。表示している教室情報・料金は制作例として掲載しています。</p></section>
  </div></main><SiteFooter /></div>;
}
