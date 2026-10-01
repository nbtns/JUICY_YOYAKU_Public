"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatLessonTimeRange } from "@/lib/booking";

type StudentCredit = { id: string; name: string; course: string | null; lesson_type: string | null; granted: number | null; reserved: number | null; completed: number | null; remaining: number; makeup_available: number };
type Reservation = { id: string; starts_at: number; ends_at: number; status: string; display_name: string; lesson_type: string; participant_count: number };
const PAGE_NOW = Date.now();

const courseLabels: Record<string, string> = { monthly3: "月3回", monthly4: "月4回", monthly8: "月8回", flex: "フレックス" };

export function MemberDashboard({ adminPreview = false, previewStudentId = null, previewStudentName = null }: { adminPreview?: boolean; previewStudentId?: string | null; previewStudentName?: string | null }) {
  const [students, setStudents] = useState<StudentCredit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const previewQuery = previewStudentId ? `?preview=${encodeURIComponent(previewStudentId)}` : "";
      const [creditResponse, reservationResponse] = await Promise.all([fetch(`/api/member/credits${previewQuery}`), fetch(`/api/member/reservations${previewQuery}`)]);
      const credits = await creditResponse.json() as { students?: StudentCredit[]; error?: string };
      const bookings = await reservationResponse.json() as { reservations?: Reservation[]; error?: string };
      if (!creditResponse.ok || !reservationResponse.ok) throw new Error(credits.error ?? bookings.error ?? "会員情報を取得できませんでした");
      setStudents(credits.students ?? []);
      setReservations(bookings.reservations ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "会員情報を取得できませんでした"); }
  }, [previewStudentId]);

  // APIから初回データを同期するため、このEffect内の状態更新は意図したものです。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!editing || !date) return;
    fetch(`/api/reservations/availability?date=${encodeURIComponent(date)}`).then(async (response) => {
      const body = await response.json() as { slots?: string[] };
      setSlots(response.ok ? body.slots ?? [] : []);
    }).catch(() => setSlots([]));
  }, [date, editing]);

  const upcoming = useMemo(() => reservations.filter((item) => item.status === "confirmed" && item.starts_at >= PAGE_NOW).sort((a, b) => a.starts_at - b.starts_at), [reservations]);
  const primary = students[0];

  async function cancel(item: Reservation) {
    if (!window.confirm(`${formatDateTime(item.starts_at)}の予約をキャンセルしますか？`)) return;
    setBusyId(item.id); setError("");
    const previewQuery = previewStudentId ? `?preview=${encodeURIComponent(previewStudentId)}` : "";
    const response = await fetch(`/api/member/reservations/${item.id}/cancel${previewQuery}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "会員ページから連絡ありキャンセル" }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setError(body.error ?? "キャンセルできませんでした"); else await load();
    setBusyId("");
  }

  async function reschedule() {
    if (!editing || !date || !time) return;
    setBusyId(editing.id); setError("");
    const previewQuery = previewStudentId ? `?preview=${encodeURIComponent(previewStudentId)}` : "";
    const response = await fetch(`/api/member/reservations/${editing.id}/reschedule${previewQuery}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, time }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setError(body.error ?? "日時を変更できませんでした"); else { setEditing(null); await load(); }
    setBusyId("");
  }

  return (
    <main className="dashboard-main">
      {adminPreview && <p className="notice" style={{ marginBottom: 24 }}>先生用プレビュー：{previewStudentName ?? primary?.name ?? "テスト会員"}さんの会員ページを表示しています。先生デモのまま会員画面を確認できます。</p>}
      <div className="dashboard-title"><div><p className="eyebrow">MY LESSONS</p><h1>{primary ? `${primary.name}さんのレッスン` : "会員ページ"}</h1><p>予約と残り回数は、教室のカレンダーと同じ最新情報です。</p></div><Link className="button button-primary" href={previewStudentId ? `/member/book?preview=${encodeURIComponent(previewStudentId)}` : "/member/book"}>レッスン予約</Link></div>
      {error && <p className="notice error-notice" role="alert">{error}</p>}
      <div className="stat-grid">
        <article className="stat-card good"><span>現在のコース</span><strong>{primary?.course ? courseLabels[primary.course] ?? primary.course : "未登録"}</strong><small>{primary?.lesson_type === "group" ? "グループ" : "個人"}レッスン</small></article>
        <article className="stat-card"><span>今月あと</span><strong>{primary?.remaining ?? 0}回</strong><small>新しく予約できます</small></article>
        <article className="stat-card"><span>予約済み / 受講済み</span><strong>{primary?.reserved ?? 0} / {primary?.completed ?? 0}</strong><small>今月分</small></article>
        <article className="stat-card"><span>振替回数</span><strong>{primary?.makeup_available ?? 0}回</strong><small>利用可能</small></article>
      </div>
      <div className="dashboard-grid">
        <section className="dash-panel"><h2>次回の予約</h2><div className="booking-list">{upcoming.length === 0 ? <p>現在、確定している予約はありません。</p> : upcoming.map((item) => <article className="booking-item booking-item-actions" key={item.id}><span className="booking-time">{formatDateTime(item.starts_at, true)}</span><div><strong>{item.display_name}</strong><p>{item.lesson_type === "group" ? `グループ（${item.participant_count}人）` : "個人レッスン"}</p></div><div className="inline-actions"><button type="button" onClick={() => { setEditing(item); setDate(""); }}>日時変更</button><button type="button" disabled={busyId === item.id} onClick={() => void cancel(item)}>キャンセル</button></div></article>)}</div></section>
        <aside className="dash-panel"><h2>今月の進み具合</h2><strong>{primary?.reserved ?? 0} / {primary?.granted ?? 0}回を予約済み</strong><div className="progress-track"><span style={{ width: `${primary?.granted ? Math.min(100, ((primary.reserved ?? 0) + (primary.completed ?? 0)) / primary.granted * 100) : 0}%` }} /></div><p style={{ fontSize: 12 }}>通常回数は月末で失効します。連絡ありキャンセルでは回数が戻ります。</p></aside>
        <section className="dash-panel"><h2>予約履歴</h2><div className="booking-list">{reservations.slice(0, 8).map((item) => <article className="booking-item" key={`history-${item.id}`}><span className="booking-time">{formatDateTime(item.starts_at, true)}</span><div><strong>{item.display_name}</strong><p>{statusLabel(item.status)}</p></div><span className="badge">{statusLabel(item.status)}</span></article>)}</div></section>
        <aside className="dash-panel"><h2>予約ルール</h2><p className="schedule-note">連絡ありのキャンセルは回数を返却します。無断キャンセルのみ1回消化します。先生都合の休講では回数返却と振替1回を付与します。</p></aside>
      </div>
      {editing && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="rescheduleTitle"><h2 id="rescheduleTitle">予約日時を変更</h2><p>現在: {formatDateTime(editing.starts_at)}</p><div className="field"><label htmlFor="rescheduleDate">新しい日付</label><input id="rescheduleDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="slot-grid">{slots.map((slot) => <button className="slot" type="button" key={slot} aria-pressed={time === slot} onClick={() => setTime(slot)}>{formatLessonTimeRange(slot)}</button>)}</div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setEditing(null)}>閉じる</button><button className="button button-primary" type="button" disabled={!time || busyId === editing.id} onClick={() => void reschedule()}>この日時へ変更</button></div></section></div>}
    </main>
  );
}

function formatDateTime(value: number, compact = false) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: compact ? undefined : "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function statusLabel(status: string) { return ({ confirmed: "確定", completed: "受講済み", cancelled_on_time: "キャンセル", cancelled_late: "無断キャンセル", no_show: "無断キャンセル", teacher_cancelled: "先生都合休講" } as Record<string, string>)[status] ?? status; }
