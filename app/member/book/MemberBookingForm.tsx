"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatLessonTimeRange } from "@/lib/booking";
import { WeeklyAvailabilityPicker } from "@/app/components/WeeklyAvailabilityPicker";

type StudentCredit = { id: string; name: string; course: string | null; lesson_type: string | null; group_id: string | null; remaining: number; makeup_available: number };
const courseLabels: Record<string, string> = { monthly3: "月3回", monthly4: "月4回", monthly8: "月8回", flex: "フレックス" };

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatJapaneseDate(value: string) {
  if (!value) return "未選択";
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00+09:00`));
}

export function MemberBookingForm({ previewStudentId = null }: { previewStudentId?: string | null }) {
  const tomorrow = useMemo(() => { const date = new Date(); date.setDate(date.getDate() + 1); return formatDateInput(date); }, []);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("");
  const [students, setStudents] = useState<StudentCredit[]>([]);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const loadCredits = useCallback(async () => {
    const previewQuery = previewStudentId ? `&preview=${encodeURIComponent(previewStudentId)}` : "";
    const response = await fetch(`/api/member/credits?month=${encodeURIComponent(date.slice(0, 7))}${previewQuery}`);
    const body = await response.json() as { students?: StudentCredit[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "残り回数を取得できませんでした");
    setStudents(body.students ?? []);
    setStudentId((current) => current && body.students?.some((student) => student.id === current) ? current : body.students?.[0]?.id ?? "");
  }, [date, previewStudentId]);

  // 選択した月に対応する残り回数をAPIから同期します。
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadCredits().catch((error) => active && setMessage(error instanceof Error ? error.message : "予約情報を取得できませんでした")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadCredits]);

  const selectedStudent = students.find((student) => student.id === studentId) ?? null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time || !selectedStudent) { setMessage("生徒と希望時刻を選んでください。"); return; }
    setSubmitting(true); setMessage("");
    const idempotencyKey = crypto.randomUUID();
    try {
      const previewQuery = previewStudentId ? `?preview=${encodeURIComponent(previewStudentId)}` : "";
      const response = await fetch(`/api/member/reservations${previewQuery}`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ studentId: selectedStudent.id, groupId: selectedStudent.lesson_type === "group" ? selectedStudent.group_id : null, date, time, idempotencyKey }),
      });
      const body = await response.json() as { error?: string; remaining?: { studentId: string; value: number }[] };
      if (!response.ok) throw new Error(body.error ?? "予約を確定できませんでした");
      const remaining = body.remaining?.find((item) => item.studentId === selectedStudent.id)?.value;
      setMessage(`${formatJapaneseDate(date)} ${formatLessonTimeRange(time)}で予約を確定しました。${remaining === undefined ? "" : ` 残り${remaining}回です。`}`);
      setTime("");
      setRefreshKey((current) => current + 1);
      await loadCredits();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "予約を確定できませんでした");
      setRefreshKey((current) => current + 1);
    } finally { setSubmitting(false); }
  }

  return (
    <form className="member-booking-layout" onSubmit={submit}>
      <section className="booking-select-panel">
        <div className="member-course-strip">
          <div><label htmlFor="bookingStudent">予約する生徒</label><select id="bookingStudent" value={studentId} onChange={(event) => { setStudentId(event.target.value); setMessage(""); }}>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></div>
          <div><span>コース</span><strong>{selectedStudent?.course ? courseLabels[selectedStudent.course] ?? selectedStudent.course : "未登録"}・{selectedStudent?.lesson_type === "group" ? "グループ" : "個人"}</strong></div>
          <div><span>今月の残り</span><strong className="remaining-count">{selectedStudent?.remaining ?? 0}回</strong></div>
        </div>
        <WeeklyAvailabilityPicker
          initialStartDate={tomorrow}
          selectedDate={date}
          selectedTime={time}
          refreshKey={refreshKey}
          onSelect={(nextDate, nextTime) => { setDate(nextDate); setTime(nextTime); setMessage(""); }}
          onClearSelection={() => setTime("")}
        />
        {loading && <p className="schedule-note">会員情報と残り回数を確認しています…</p>}
      </section>
      <aside className="booking-confirm-panel">
        <p className="eyebrow">BOOKING SUMMARY</p><h2>予約内容</h2>
        <dl className="booking-summary-list">
          <div><dt>生徒</dt><dd>{selectedStudent?.name ?? "未登録"}</dd></div><div><dt>形式</dt><dd>{selectedStudent?.lesson_type === "group" ? "グループ" : "個人レッスン"}</dd></div><div><dt>日付</dt><dd>{formatJapaneseDate(date)}</dd></div><div><dt>時刻</dt><dd className={time ? "summary-selected" : ""}>{time ? formatLessonTimeRange(time) : "未選択"}</dd></div><div><dt>現在の残り</dt><dd>{selectedStudent?.remaining ?? 0}回＋振替{selectedStudent?.makeup_available ?? 0}回</dd></div>
        </dl>
        <p className="booking-rule-note">連絡ありキャンセルでは回数を返却します。無断キャンセルの場合のみ1回分を消化します。</p>
        <button className="button button-primary member-booking-button" type="submit" disabled={loading || !time || !selectedStudent || (selectedStudent.remaining <= 0 && selectedStudent.makeup_available <= 0) || submitting}>{submitting ? "予約を確定中…" : "この日時で予約する"}</button>
        <p className="form-status" role="status" aria-live="polite">{message}</p>
      </aside>
    </form>
  );
}
