"use client";

import { FormEvent, useMemo, useState } from "react";
import { WeeklyAvailabilityPicker } from "@/app/components/WeeklyAvailabilityPicker";

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TrialForm() {
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return formatDateInput(date);
  }, []);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time) {
      setStatus("ご希望の時刻を選んでください。");
      return;
    }
    setSubmitting(true);
    setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/trials", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ ...payload, date, time, idempotencyKey }),
      });
      const body = await response.json() as { message?: string; error?: string; reference?: string; manageToken?: string };
      if (!response.ok) throw new Error(body.error ?? "送信できませんでした");
      const manageLink = body.reference && body.manageToken ? ` /trial/manage/${encodeURIComponent(body.reference)}?token=${encodeURIComponent(body.manageToken)}` : "";
      setStatus(`${body.message} 受付番号: ${body.reference}${manageLink ? ` 確認・変更ページ: ${manageLink}` : ""}`);
      formElement.reset();
      setTime("");
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "送信できませんでした。時間をおいてお試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>無料体験のお申し込み</h2>
      <p className="notice">架空の氏名・連絡先だけを入力してください。メールは @example.com、電話は 09000000000 を使用します。</p>
      <p className="notice">予約は1時間刻みです。前後の休憩時間はなく、空いていれば続けて予約できます。</p>
      <WeeklyAvailabilityPicker
        initialStartDate={tomorrow}
        selectedDate={date}
        selectedTime={time}
        refreshKey={refreshKey}
        onSelect={(nextDate, nextTime) => { setDate(nextDate); setTime(nextTime); setStatus(""); }}
        onClearSelection={() => setTime("")}
      />
      <div className="form-grid" style={{ marginTop: 28 }}>
        <div className="field"><label htmlFor="studentName">生徒氏名 *</label><input id="studentName" name="studentName" defaultValue="デモ 体験生" autoComplete="off" required maxLength={80} /></div>
        <div className="field"><label htmlFor="birthDate">生年月日 *</label><input id="birthDate" name="birthDate" type="date" defaultValue="2000-01-01" required /></div>
        <div className="field"><label htmlFor="email">メールアドレス *</label><input id="email" name="email" type="email" defaultValue="trial@example.com" autoComplete="off" required maxLength={254} /></div>
        <div className="field"><label htmlFor="phone">電話番号 *</label><input id="phone" name="phone" type="tel" defaultValue="09000000000" autoComplete="off" inputMode="tel" required maxLength={30} /><p className="field-hint">架空の電話番号を使用してください</p></div>
        <div className="field"><label htmlFor="experience">ギター経験</label><select id="experience" name="experience"><option value="beginner">未経験</option><option value="experienced">経験あり</option></select></div>
        <div className="field"><label htmlFor="instrument">楽器の有無</label><select id="instrument" name="instrument"><option value="none">持っていない</option><option value="acoustic">アコースティックギター</option><option value="electric">エレキギター</option><option value="other">その他</option></select></div>
        <div className="field full"><label htmlFor="song">弾いてみたい曲</label><input id="song" name="song" maxLength={160} placeholder="曲名・アーティスト名など" /></div>
        <div className="field"><label htmlFor="guardianName">保護者氏名（未成年のみ）</label><input id="guardianName" name="guardianName" maxLength={80} /></div>
        <div className="field"><label htmlFor="guardianContact">保護者連絡先（未成年のみ）</label><input id="guardianContact" name="guardianContact" maxLength={254} /></div>
        <div className="field full"><label htmlFor="notes">その他伝えたいこと</label><textarea id="notes" name="notes" maxLength={1000} /></div>
        <label className="checkbox field full"><input name="privacyConsent" type="checkbox" value="agreed" required /><span>個人情報の取り扱いとプライバシーポリシーに同意します *</span></label>
        <label className="checkbox field full"><input name="cancellationConsent" type="checkbox" value="agreed" required /><span>キャンセル・振替規約に同意します *</span></label>
        <div className="field full" aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      </div>
      <div className="form-actions">
        <p className="form-status" role="status" aria-live="polite">{status}</p>
        <button className="button button-primary" type="submit" disabled={submitting || !time}>{submitting ? "送信中…" : "この内容で申し込む"}</button>
      </div>
    </form>
  );
}
