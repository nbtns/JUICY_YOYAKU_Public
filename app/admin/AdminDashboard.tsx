"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Reservation = { id: string; booking_type: "trial" | "member"; starts_at: number; status: string; display_name: string; lesson_type: string; participant_count: number; attention_required: number };
type Member = { id: string; name: string; email: string; course: string | null; lesson_type: string | null; status: string | null };
const PAGE_NOW = Date.now();

export function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const [reservationResponse, memberResponse] = await Promise.all([fetch("/api/admin/reservations"), fetch("/api/admin/members")]);
    const bookings = await reservationResponse.json() as { reservations?: Reservation[]; error?: string };
    const memberList = await memberResponse.json() as { members?: Member[]; error?: string };
    if (!reservationResponse.ok || !memberResponse.ok) throw new Error(bookings.error ?? memberList.error ?? "管理情報を取得できませんでした");
    setReservations(bookings.reservations ?? []);
    setMembers(memberList.members ?? []);
  }, []);
  // APIから初回データを同期するため、このEffect内の状態更新は意図したものです。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : "予約を取得できませんでした")); }, [load]);

  const todayKey = tokyoDateKey(PAGE_NOW);
  const today = useMemo(() => reservations.filter((item) => tokyoDateKey(item.starts_at) === todayKey), [reservations, todayKey]);
  const futureTrials = reservations.filter((item) => item.booking_type === "trial" && item.status === "confirmed" && item.starts_at >= PAGE_NOW);
  const attention = reservations.filter((item) => item.attention_required);

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/admin/members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { error?: string; name?: string; granted?: number };
    if (!response.ok) setMessage(body.error ?? "会員を登録できませんでした"); else { setMessage(`${body.name}さんを登録し、今月${body.granted}回を付与しました。下のボタンから会員ページを確認できます。`); form.reset(); await load(); }
    setSaving(false);
  }

  return (
    <main className="dashboard-main">
      <div className="dashboard-title"><div><p className="eyebrow">TODAY / {todayKey.replaceAll("-", ".")}</p><h1>教室ダッシュボード</h1><p>無料体験と会員レッスンを、同じ予約データから表示しています。</p></div><Link className="button button-primary" href="/admin/calendar">予約カレンダー</Link></div>
      {message && <p className="notice" role="status">{message}</p>}
      <div className="stat-grid">
        <article className="stat-card"><span>今日の予約</span><strong>{today.length}件</strong><small>{today.filter((item) => item.status === "confirmed").length}件が確定中</small></article>
        <article className="stat-card"><span>無料体験予定</span><strong>{futureTrials.length}件</strong><small>表示期間内</small></article>
        <article className={`stat-card ${attention.length ? "alert" : "good"}`}><span>本人確認候補</span><strong>{attention.length}件</strong><small>重複候補を確認</small></article>
        <article className="stat-card good"><span>予約データ連携</span><strong>稼働中</strong><small>会員・体験・管理で共通</small></article>
      </div>
      <div className="dashboard-grid">
        <section className="dash-panel"><h2>今日のレッスン</h2><div className="booking-list">{today.length === 0 ? <p>今日の予約はありません。</p> : today.sort((a, b) => a.starts_at - b.starts_at).map((item) => <article className="booking-item" key={`${item.booking_type}-${item.id}`}><span className="booking-time">{formatTime(item.starts_at)}</span><div><strong>{item.display_name}</strong><p>{item.booking_type === "trial" ? "無料体験" : item.lesson_type === "group" ? `グループ（${item.participant_count}人）` : "個人レッスン"}</p></div><span className="badge">{statusLabel(item.status)}</span></article>)}</div></section>
        <aside className="dash-panel"><h2>管理メニュー</h2><div className="action-list"><Link href="/admin/calendar">予約の追加・変更・出欠 <span>→</span></Link><Link href="/admin/calendar#blocks">休業日・NG時間 <span>→</span></Link></div><p className="schedule-note" style={{ marginTop: 18 }}>管理操作には理由が必要で、変更前後の内容を履歴へ残します。</p></aside>
        <section className="dash-panel" id="test-members"><h2>テスト会員を登録・確認</h2><p>架空の会員を登録し、先生デモのまま各会員の画面を確認できます。メールは @example.com、電話は 09000000000 を使用してください。</p><form className="compact-form" onSubmit={createMember}><div className="form-grid"><div className="field"><label htmlFor="memberName">氏名</label><input id="memberName" name="name" required /></div><div className="field"><label htmlFor="memberEmail">デモ用メール</label><input id="memberEmail" name="email" type="email" placeholder="new-member@example.com" required /></div><div className="field"><label htmlFor="memberBirthDate">生年月日</label><input id="memberBirthDate" name="birthDate" type="date" required /></div><div className="field"><label htmlFor="memberPhone">電話番号</label><input id="memberPhone" name="phone" type="tel" placeholder="09000000000" required /></div><div className="field"><label htmlFor="memberCourse">コース</label><select id="memberCourse" name="course" defaultValue="monthly4"><option value="monthly3">月3回</option><option value="monthly4">月4回</option><option value="monthly8">月8回</option></select></div><div className="field"><span>形式</span><strong>個人レッスン</strong><input name="lessonType" type="hidden" value="individual" /></div></div><button className="button button-primary" type="submit" disabled={saving}>{saving ? "登録中…" : "会員登録と回数付与"}</button></form><div className="member-preview-list"><h3>登録済み会員</h3>{members.length === 0 ? <p>まだ会員が登録されていません。</p> : members.map((member) => <article className="member-preview-row" key={member.id}><div><strong>{member.name}</strong><small>{member.email}・{courseLabel(member.course)}</small></div><Link className="button button-secondary" href={`/member?preview=${encodeURIComponent(member.id)}`}>この会員ページを見る</Link></article>)}</div></section>
        <aside className="dash-panel"><h2>運用ルール</h2><ul className="admin-rule-list"><li>連絡ありキャンセルは回数返却</li><li>無断キャンセルは1回消化</li><li>先生都合は回数返却＋振替1回</li><li>翌月予約は毎月21日9:00解放</li></ul></aside>
      </div>
    </main>
  );
}

function tokyoDateKey(value: number) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatTime(value: number) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function statusLabel(status: string) { return ({ confirmed: "確定", completed: "完了", cancelled: "キャンセル", cancelled_on_time: "キャンセル", no_show: "無断欠席", teacher_cancelled: "先生都合" } as Record<string, string>)[status] ?? status; }
function courseLabel(course: string | null) { return ({ monthly3: "月3回", monthly4: "月4回", monthly8: "月8回", flex: "フレックス" } as Record<string, string>)[course ?? ""] ?? "コース未登録"; }
