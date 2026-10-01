"use client";

import { useEffect, useState } from "react";
import { formatLessonTimeRange } from "@/lib/booking";

type Trial = { reference: string; studentName: string; startsAt: string; endsAt: string; status: string };

export function TrialManageForm({ reference, token }: { reference: string; token: string }) {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [date, setDate] = useState(""); const [time, setTime] = useState(""); const [slots, setSlots] = useState<string[]>([]); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const response = await fetch(`/api/trials/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`); const body = await response.json() as Trial & { error?: string }; if (!response.ok) throw new Error(body.error ?? "予約を確認できませんでした"); setTrial(body); }
  // 専用トークンで予約を初回取得するため、このEffect内の状態更新は意図したものです。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : "予約を確認できませんでした")); }, [reference, token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!date) return; fetch(`/api/reservations/availability?date=${date}`).then(async (response) => { const body = await response.json() as { slots?: string[] }; setSlots(response.ok ? body.slots ?? [] : []); }).catch(() => setSlots([])); }, [date]);
  async function reschedule() { if (!date || !time) return; setBusy(true); const response = await fetch(`/api/trials/${encodeURIComponent(reference)}/reschedule`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, date, time }) }); const body = await response.json() as { error?: string }; if (!response.ok) setMessage(body.error ?? "日時を変更できませんでした"); else { setMessage("予約日時を変更しました。"); setDate(""); setTime(""); await load(); } setBusy(false); }
  async function cancel() { if (!window.confirm("無料体験の予約をキャンセルしますか？")) return; setBusy(true); const response = await fetch(`/api/trials/${encodeURIComponent(reference)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, reason: "本人から連絡あり" }) }); const body = await response.json() as { error?: string }; if (!response.ok) setMessage(body.error ?? "キャンセルできませんでした"); else { setMessage("予約をキャンセルしました。"); await load(); } setBusy(false); }
  return <section className="panel"><h2>受付番号 {reference}</h2>{message && <p className="notice" role="status">{message}</p>}{trial && <><dl className="booking-summary-list manage-summary"><div><dt>お名前</dt><dd>{trial.studentName}</dd></div><div><dt>日時</dt><dd>{formatDateTime(trial.startsAt)}</dd></div><div><dt>状態</dt><dd>{trial.status === "confirmed" ? "予約確定" : trial.status === "cancelled" ? "キャンセル済み" : trial.status}</dd></div></dl>{trial.status === "confirmed" && <div className="manage-actions"><h3>日時を変更</h3><div className="field"><label htmlFor="trialRescheduleDate">新しい日付</label><input id="trialRescheduleDate" type="date" value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} /></div><div className="slot-grid">{slots.map((slot) => <button className="slot" type="button" aria-pressed={time === slot} key={slot} onClick={() => setTime(slot)}>{formatLessonTimeRange(slot)}</button>)}</div><div className="modal-actions"><button className="button button-primary" type="button" disabled={!time || busy} onClick={() => void reschedule()}>この日時へ変更</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => void cancel()}>予約をキャンセル</button></div></div>}</>}</section>;
}

function formatDateTime(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
