"use client";

import { FormEvent, KeyboardEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { contiguousSlotRanges, createDailySlots, formatLessonTimeRange, updateSlotSelection } from "@/lib/booking";

type View = "day" | "week" | "month";
type Reservation = { id: string; booking_type: "trial" | "member"; starts_at: number; ends_at: number; status: string; display_name: string; lesson_type: string; participant_count: number; attention_required: number };
type Block = { id: string; starts_at: number; ends_at: number; reason: string };
type Member = { id: string; name: string; course: string; lesson_type: string };
type BlockSlotState = { kind: "reservation" | "blocked" | "available"; label: string };
const PAGE_NOW = Date.now();
const INITIAL_DATE = tokyoDateKey(PAGE_NOW);
const INITIAL_BOOKING_DATE = tokyoDateKey(PAGE_NOW + 24 * 60 * 60_000);
const INITIAL_WEEK_START = startOfWeek(INITIAL_DATE);
const BLOCK_TIMES = createDailySlots();

export function AdminCalendar() {
  const [view, setView] = useState<View>("week");
  const [selectedDate, setSelectedDate] = useState(INITIAL_DATE);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockReservations, setBlockReservations] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookingDate, setBookingDate] = useState(INITIAL_BOOKING_DATE);
  const [slots, setSlots] = useState<string[]>([]);
  const [blockDate, setBlockDate] = useState(INITIAL_DATE);
  const [blockWeekStart, setBlockWeekStart] = useState(INITIAL_WEEK_START);
  const [selectedBlockSlots, setSelectedBlockSlots] = useState<Record<string, number[]>>({});
  const dragModeRef = useRef<"select" | "deselect" | null>(null);
  const dragVisitedRef = useRef(new Set<string>());
  const range = useMemo(() => dateRange(selectedDate, view), [selectedDate, view]);
  const blockWeekDates = useMemo(() => sevenDateKeys(blockWeekStart), [blockWeekStart]);

  const load = useCallback(async () => {
    const [reservationResponse, blockReservationResponse, blockResponse, memberResponse] = await Promise.all([
      fetch(`/api/admin/reservations?from=${range.from}&to=${range.to}`),
      fetch(`/api/admin/reservations?from=${blockWeekDates[0]}&to=${blockWeekDates[6]}`),
      fetch("/api/admin/calendar-blocks"),
      fetch("/api/admin/members"),
    ]);
    const reservationBody = await reservationResponse.json() as { reservations?: Reservation[]; error?: string };
    const blockReservationBody = await blockReservationResponse.json() as { reservations?: Reservation[]; error?: string };
    const blockBody = await blockResponse.json() as { blocks?: Block[]; error?: string };
    const memberBody = await memberResponse.json() as { members?: Member[]; error?: string };
    if (!reservationResponse.ok || !blockReservationResponse.ok || !blockResponse.ok || !memberResponse.ok) throw new Error(reservationBody.error ?? blockReservationBody.error ?? blockBody.error ?? memberBody.error ?? "管理データを取得できませんでした");
    setReservations(reservationBody.reservations ?? []); setBlockReservations(blockReservationBody.reservations ?? []); setBlocks(blockBody.blocks ?? []); setMembers(memberBody.members ?? []);
  }, [blockWeekDates, range.from, range.to]);

  // APIから表示期間のデータを同期するため、このEffect内の状態更新は意図したものです。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : "管理データを取得できませんでした")); }, [load]);
  useEffect(() => { fetch(`/api/reservations/availability?date=${bookingDate}`).then(async (response) => { const body = await response.json() as { slots?: string[] }; setSlots(response.ok ? body.slots ?? [] : []); }).catch(() => setSlots([])); }, [bookingDate, reservations, blocks]);
  useEffect(() => {
    const stopDragging = () => { dragModeRef.current = null; dragVisitedRef.current.clear(); };
    window.addEventListener("pointerup", stopDragging); window.addEventListener("pointercancel", stopDragging);
    return () => { window.removeEventListener("pointerup", stopDragging); window.removeEventListener("pointercancel", stopDragging); };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const reservation of reservations) { const key = tokyoDateKey(reservation.starts_at); map.set(key, [...(map.get(key) ?? []), reservation]); }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [reservations]);

  const blockSlotStates = useMemo<Record<string, BlockSlotState[]>>(() => Object.fromEntries(blockWeekDates.map((date) => [date, BLOCK_TIMES.map((time) => {
    const startsAt = tokyoDateTime(date, time);
    const endsAt = startsAt + 60 * 60_000;
    const reservation = blockReservations.find((item) => item.status === "confirmed" && startsAt < item.ends_at && item.starts_at < endsAt);
    if (reservation) return { kind: "reservation", label: `${reservation.display_name}さんの予約` };
    const block = blocks.find((item) => startsAt < item.ends_at && item.starts_at < endsAt);
    if (block) return { kind: "blocked", label: block.reason };
    return { kind: "available", label: "選択できます" };
  })])), [blockReservations, blockWeekDates, blocks]);

  const selectedBlockRanges = useMemo(() => Object.entries(selectedBlockSlots).flatMap(([date, indexes]) => contiguousSlotRanges(indexes).map((range) => ({ date, ...range, startsAt: BLOCK_TIMES[range.from], endsAt: toTimeLabel(10 * 60 + (range.to + 1) * 60) }))), [selectedBlockSlots]);
  const selectedBlockCount = useMemo(() => Object.values(selectedBlockSlots).reduce((total, indexes) => total + indexes.length, 0), [selectedBlockSlots]);
  const weekBlockGroups = useMemo(() => blockWeekDates.map((date) => ({ date, items: blocks.filter((block) => tokyoDateKey(block.starts_at) === date).sort((a, b) => a.starts_at - b.starts_at) })).filter((group) => group.items.length > 0), [blockWeekDates, blocks]);

  async function action(item: Reservation, actionName: "complete" | "no-show" | "cancel" | "teacher-cancel") {
    const reason = window.prompt("操作理由を入力してください");
    if (!reason) return;
    setBusy(true); setMessage("");
    const base = item.booking_type === "trial" ? "/api/admin/trials" : "/api/admin/reservations";
    const response = await fetch(`${base}/${item.id}/${actionName}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage(body.error ?? "操作を完了できませんでした"); else { setMessage("予約状態と回数を更新しました。"); await load(); }
    setBusy(false);
  }

  async function reschedule(item: Reservation) {
    const date = window.prompt("新しい日付（YYYY-MM-DD）", tokyoDateKey(item.starts_at));
    const time = window.prompt("新しい開始時刻（例 14:00）", formatTime(item.starts_at));
    const reason = window.prompt("変更理由");
    if (!date || !time || !reason) return;
    setBusy(true); setMessage("");
    const base = item.booking_type === "trial" ? "/api/admin/trials" : "/api/admin/reservations";
    const response = await fetch(`${base}/${item.id}/reschedule`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, time, reason }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage(body.error ?? "日時を変更できませんでした"); else { setMessage("予約日時を変更しました。"); await load(); }
    setBusy(false);
  }

  async function createBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    const idempotencyKey = crypto.randomUUID();
    const response = await fetch("/api/admin/reservations", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ ...payload, date: bookingDate, idempotencyKey }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage(body.error ?? "予約を追加できませんでした"); else { setMessage("会員予約を追加し、回数を確保しました。"); form.reset(); await load(); }
    setBusy(false);
  }

  function changeBlockSlot(date: string, index: number, mode: "select" | "deselect" | "toggle") {
    const daySlots = blockSlotStates[date] ?? [];
    if (daySlots[index]?.kind !== "available") { setMessage("予約済みまたはNG登録済みの時間は選べません。"); return; }
    setSelectedBlockSlots((current) => {
      const next = { ...current };
      const daySelection = updateSlotSelection(current[date] ?? [], index, mode);
      if (daySelection.length) next[date] = daySelection; else delete next[date];
      return next;
    });
    setBlockDate(date); setMessage("");
  }

  function startBlockDrag(date: string, index: number, event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || blockSlotStates[date]?.[index]?.kind !== "available") return;
    event.preventDefault();
    const mode = selectedBlockSlots[date]?.includes(index) ? "deselect" : "select";
    dragModeRef.current = mode; dragVisitedRef.current = new Set([`${date}:${index}`]);
    changeBlockSlot(date, index, mode);
  }

  function continueBlockDrag(date: string, index: number) {
    const mode = dragModeRef.current;
    const key = `${date}:${index}`;
    if (!mode || dragVisitedRef.current.has(key) || blockSlotStates[date]?.[index]?.kind !== "available") return;
    dragVisitedRef.current.add(key); changeBlockSlot(date, index, mode);
  }

  function handleBlockKey(date: string, index: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault(); changeBlockSlot(date, index, "toggle");
  }

  function resetBlockSelection() {
    setSelectedBlockSlots({}); setMessage("");
  }

  function changeBlockWeek(value: string) {
    const weekStart = startOfWeek(value);
    setBlockWeekStart(weekStart); setBlockDate(weekStart); setSelectedDate(weekStart); setView("week"); setSelectedBlockSlots({}); setMessage("");
  }

  function moveBlockWeek(offset: number) {
    changeBlockWeek(addDays(blockWeekStart, offset * 7));
  }

  async function createBlock() {
    if (selectedBlockRanges.length === 0) { setMessage("NGにする時間を選んでください。"); return; }
    setBusy(true); setMessage("");
    const payload = { ranges: selectedBlockRanges.map((range) => ({ startsAt: `${range.date}T${range.startsAt}:00+09:00`, endsAt: `${range.date}T${range.endsAt}:00+09:00` })) };
    const response = await fetch("/api/admin/calendar-blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage(body.error ?? "予約不可時間を追加できませんでした"); else { setMessage(`${selectedBlockCount}時間を予約不可にしました。`); setSelectedBlockSlots({}); await load(); }
    setBusy(false);
  }

  async function releaseBlock(block: Block) {
    const response = await fetch(`/api/admin/calendar-blocks/${block.id}`, { method: "DELETE" });
    const body = await response.json() as { error?: string };
    if (!response.ok) setMessage(body.error ?? "解除できませんでした"); else { setMessage("予約不可時間を解除しました。"); await load(); }
  }

  return (
    <main className="dashboard-main calendar-page">
      <div className="dashboard-title"><div><p className="eyebrow">UNIFIED CALENDAR</p><h1>予約カレンダー</h1><p>無料体験、会員予約、予約不可時間を一か所で確認します。</p></div></div>
      {message && <p className="notice" role="status">{message}</p>}
      <section className="calendar-toolbar"><div className="view-switch" aria-label="表示範囲">{(["day", "week", "month"] as View[]).map((item) => <button type="button" key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item === "day" ? "日" : item === "week" ? "週" : "月"}</button>)}</div><label>基準日 <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><strong>{range.from} 〜 {range.to}</strong></section>
      <div className="calendar-legend"><span><i className="legend-member" /> 会員レッスン</span><span><i className="legend-trial" /> 無料体験</span><span><i className="legend-block" /> 予約不可</span></div>
      <section className="calendar-days">{grouped.length === 0 ? <div className="calendar-empty">この期間の予約はありません。</div> : grouped.map(([date, items]) => <article className="calendar-day" key={date}><header><strong>{formatDay(date)}</strong><span>{items.length}件</span></header><div>{items.map((item) => <section className={`calendar-event ${item.booking_type}`} key={`${item.booking_type}-${item.id}`}><div><time>{formatTime(item.starts_at)}〜{formatTime(item.ends_at)}</time><strong>{item.display_name}</strong><small>{item.booking_type === "trial" ? "無料体験" : item.lesson_type === "group" ? `グループ ${item.participant_count}人` : "個人レッスン"} / {statusLabel(item.status)}</small></div>{item.status === "confirmed" && <div className="calendar-actions"><button disabled={busy} onClick={() => void reschedule(item)}>変更</button><button disabled={busy} onClick={() => void action(item, "complete")}>完了</button><button disabled={busy} onClick={() => void action(item, "no-show")}>無断欠席</button><button disabled={busy} onClick={() => void action(item, "cancel")}>連絡あり取消</button>{item.booking_type === "member" && <button disabled={busy} onClick={() => void action(item, "teacher-cancel")}>先生都合</button>}</div>}</section>)}</div></article>)}</section>
      <div className="calendar-admin-grid">
        <section className="dash-panel admin-booking-panel"><div className="admin-booking-heading"><p className="eyebrow">ADD MEMBER BOOKING</p><h2>会員予約を追加</h2><p>生徒と日時を選び、空き時間へ予約を追加します。</p></div><form className="admin-booking-form" onSubmit={createBooking}><div className="field"><label htmlFor="adminStudent">生徒</label><select id="adminStudent" name="studentId" required>{members.map((member) => <option key={member.id} value={member.id}>{member.name} / {member.course}</option>)}</select></div><div className="field"><label htmlFor="adminBookingDate">日付</label><input id="adminBookingDate" type="date" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} /></div><div className="field"><label htmlFor="adminBookingTime">空き時間</label><select id="adminBookingTime" name="time" required><option value="">選択してください</option>{slots.map((slot) => <option key={slot} value={slot}>{formatLessonTimeRange(slot)}</option>)}</select></div><button className="button button-primary" disabled={busy || members.length === 0}>予約と回数を確定</button></form></section>
        <section className="dash-panel visual-block-panel" id="blocks">
          <div className="visual-block-heading"><div><p className="eyebrow">AVAILABILITY BLOCKER</p><h2>予約不可時間</h2><p>クリックで1枠ずつON／OFF。未選択からドラッグするとまとめて選択、選択済みからドラッグするとまとめて解除できます。</p></div><div className="block-week-controls"><button type="button" onClick={() => moveBlockWeek(-1)}>← 前の週</button><label>表示する週<input type="date" value={blockWeekStart} onChange={(event) => changeBlockWeek(event.target.value)} /></label><button type="button" onClick={() => moveBlockWeek(1)}>次の週 →</button></div></div>
          <div className="block-timeline-legend" aria-label="時間帯の表示説明"><span><i className="available" />選択できます</span><span><i className="selected" />今回NGにする</span><span><i className="reservation" />予約あり</span><span><i className="blocked" />NG登録済み</span></div>
          <div className="block-timeline block-week-timeline" role="group" aria-label={`${formatDay(blockWeekDates[0])}から7日間の予約不可時間を選択`}>
            <div className="block-week-table">
              <div className="block-week-header"><span>時間</span>{blockWeekDates.map((date) => <div className={`${date === blockDate ? "active" : ""} ${selectedBlockSlots[date]?.length ? "has-selection" : ""}`} key={date}><strong>{formatShortDay(date)}</strong><small>{formatWeekday(date)}</small></div>)}</div>
              {BLOCK_TIMES.map((time, index) => <div className="block-week-row" key={time}><time>{time}</time>{blockWeekDates.map((date) => {
                const slot = blockSlotStates[date]?.[index] ?? { kind: "available" as const, label: "選択できます" };
                const isSelected = selectedBlockSlots[date]?.includes(index) ?? false;
                const state = isSelected ? "selected" : slot.kind;
                const stateLabel = isSelected ? "NG" : slot.kind === "available" ? "空き" : slot.kind === "reservation" ? "予約" : "NG済";
                return <button className={`block-week-cell ${state}`} type="button" key={date} title={slot.label} disabled={slot.kind !== "available"} aria-label={`${formatDay(date)} ${time} ${stateLabel}`} aria-pressed={isSelected} onPointerDown={(event) => startBlockDrag(date, index, event)} onPointerEnter={() => continueBlockDrag(date, index)} onKeyDown={(event) => handleBlockKey(date, index, event)}>{stateLabel}</button>;
              })}</div>)}
              <div className="block-week-end"><time>21:00</time></div>
            </div>
          </div>
          <div className="block-selection-card">
            <div><span>選択中</span><strong>{selectedBlockCount ? `${selectedBlockCount}時間` : "時間を選んでください"}</strong><small>{selectedBlockCount ? `${selectedBlockRanges.length}件の連続したNG時間として登録します` : "クリックまたはドラッグで選択できます"}</small></div>
            <div className="block-selection-actions"><button type="button" disabled={busy || selectedBlockCount === 0} onClick={resetBlockSelection}>選択をリセット</button><button className="button button-secondary" type="button" disabled={busy || selectedBlockCount === 0} onClick={() => void createBlock()}>選択したNGを保存</button></div>
          </div>
          <div className="block-list"><h3>表示中の週の登録済みNG</h3>{weekBlockGroups.length === 0 ? <p>この週のNG時間はまだありません。</p> : weekBlockGroups.map((group) => <section className="block-list-day" key={group.date}><header><strong>{formatDay(group.date)}</strong><span>{group.items.length}件</span></header><div className="block-list-items">{group.items.map((block) => <div className="block-list-item" key={block.id}><strong>{formatTime(block.starts_at)}〜{formatTime(block.ends_at)}</strong><button onClick={() => void releaseBlock(block)}>解除</button></div>)}</div></section>)}</div>
        </section>
      </div>
    </main>
  );
}

function dateRange(date: string, view: View) { const base = new Date(`${date}T12:00:00+09:00`); if (view === "day") return { from: date, to: date }; if (view === "week") { const day = base.getDay(); const start = new Date(base); start.setDate(base.getDate() - day); const end = new Date(start); end.setDate(start.getDate() + 6); return { from: localDateKey(start), to: localDateKey(end) }; } const from = `${date.slice(0, 7)}-01`; const end = new Date(`${from}T12:00:00+09:00`); end.setMonth(end.getMonth() + 1); end.setDate(0); return { from, to: localDateKey(end) }; }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function tokyoDateKey(value: number) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function formatDay(value: string) { return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00+09:00`)); }
function formatTime(value: number) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)); }
function statusLabel(status: string) { return ({ confirmed: "確定", completed: "完了", cancelled: "キャンセル", cancelled_on_time: "キャンセル", no_show: "無断欠席", teacher_cancelled: "先生都合" } as Record<string, string>)[status] ?? status; }
function toTimeLabel(totalMinutes: number) { return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`; }
function tokyoDateTime(date: string, time: string) { return new Date(`${date}T${time}:00+09:00`).getTime(); }
function startOfWeek(value: string) { const date = new Date(`${value}T12:00:00+09:00`); date.setDate(date.getDate() - date.getDay()); return localDateKey(date); }
function addDays(value: string, days: number) { const date = new Date(`${value}T12:00:00+09:00`); date.setDate(date.getDate() + days); return localDateKey(date); }
function sevenDateKeys(start: string) { return Array.from({ length: 7 }, (_, index) => addDays(start, index)); }
function formatShortDay(value: string) { return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(`${value}T12:00:00+09:00`)); }
function formatWeekday(value: string) { return new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(new Date(`${value}T12:00:00+09:00`)); }
