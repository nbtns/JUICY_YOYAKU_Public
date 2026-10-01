import { policy } from "./config.ts";

const TOKYO_OFFSET = "+09:00";

export type TimeRange = { start: Date; end: Date };
export type SlotSelectionRange = { from: number; to: number };

export function minutesFromMidnight(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("時刻はHH:mm形式で指定してください");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function toTimeLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatLessonTimeRange(time: string) {
  const startMinutes = minutesFromMidnight(time);
  return `${toTimeLabel(startMinutes)}〜${toTimeLabel(startMinutes + policy.lessonMinutes)}`;
}

export function extendSlotSelection(current: SlotSelectionRange | null, index: number, unavailableIndexes: number[] = []) {
  const from = current ? Math.min(current.from, index) : index;
  const to = current ? Math.max(current.to, index) : index;
  return unavailableIndexes.some((unavailable) => unavailable >= from && unavailable <= to) ? null : { from, to };
}

export function updateSlotSelection(current: number[], index: number, mode: "select" | "deselect" | "toggle" = "toggle") {
  const next = new Set(current);
  const shouldSelect = mode === "select" || (mode === "toggle" && !next.has(index));
  if (shouldSelect) next.add(index); else next.delete(index);
  return [...next].sort((a, b) => a - b);
}

export function contiguousSlotRanges(indexes: number[]) {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const ranges: SlotSelectionRange[] = [];
  for (const index of sorted) {
    const previous = ranges.at(-1);
    if (previous && index === previous.to + 1) previous.to = index;
    else ranges.push({ from: index, to: index });
  }
  return ranges;
}

export function createDailySlots() {
  const slots: string[] = [];
  for (let minute = 10 * 60; minute <= 20 * 60; minute += 60) {
    slots.push(toTimeLabel(minute));
  }
  return slots;
}

export function slotRange(date: string, time: string): TimeRange {
  const start = new Date(`${date}T${time}:00${TOKYO_OFFSET}`);
  if (Number.isNaN(start.getTime())) throw new Error("日時が正しくありません");
  return {
    start,
    end: new Date(start.getTime() + policy.lessonMinutes * 60_000),
  };
}

export function hasRequiredBuffer(candidate: TimeRange, existing: TimeRange[]) {
  const buffer = policy.bufferMinutes * 60_000;
  return existing.every(
    (lesson) =>
      candidate.end.getTime() + buffer <= lesson.start.getTime() ||
      lesson.end.getTime() + buffer <= candidate.start.getTime(),
  );
}

export function availableSlots(date: string, existing: TimeRange[], blocked: TimeRange[] = []) {
  return createDailySlots().filter((time) => {
    const candidate = slotRange(date, time);
    const isBlocked = blocked.some(
      (range) => candidate.start < range.end && range.start < candidate.end,
    );
    return !isBlocked && hasRequiredBuffer(candidate, existing);
  });
}

export function slotAvailability(date: string, existing: TimeRange[], blocked: TimeRange[] = []) {
  const available = new Set(availableSlots(date, existing, blocked));
  return createDailySlots().map((time) => ({ time, available: available.has(time) }));
}

export function isCancellationRefundable(isNoShow: boolean) {
  return !isNoShow;
}

export function paymentBookingAllowed(failedAt: Date | null, now: Date) {
  if (!failedAt) return true;
  const suspensionAt = failedAt.getTime() + policy.paymentGraceDays * 24 * 60 * 60_000;
  return now.getTime() < suspensionAt;
}

export function membershipStartMonth(decidedAt: Date) {
  const tokyo = new Date(decidedAt.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const offsetMonths = tokyo.getDate() <= 20 ? 1 : 2;
  const start = new Date(tokyo.getFullYear(), tokyo.getMonth() + offsetMonths, 1);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}
