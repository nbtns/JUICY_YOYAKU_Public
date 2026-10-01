import assert from "node:assert/strict";
import test from "node:test";
import {
  availableSlots,
  createDailySlots,
  contiguousSlotRanges,
  extendSlotSelection,
  formatLessonTimeRange,
  hasRequiredBuffer,
  isCancellationRefundable,
  membershipStartMonth,
  paymentBookingAllowed,
  slotAvailability,
  slotRange,
  updateSlotSelection,
} from "../lib/booking.ts";

test("時間枠を追加しても既存の選択範囲を維持して広げる", () => {
  const first = extendSlotSelection(null, 10);
  const second = extendSlotSelection(first, 11);
  const third = extendSlotSelection(second, 12);
  assert.deepEqual(first, { from: 10, to: 10 });
  assert.deepEqual(second, { from: 10, to: 11 });
  assert.deepEqual(third, { from: 10, to: 12 });
  assert.equal(extendSlotSelection(first, 12, [11]), null);
});

test("選択済み枠は再クリックで解除し、ドラッグ範囲はまとめて選択・解除できる", () => {
  const selected = updateSlotSelection([], 10, "select");
  assert.deepEqual(updateSlotSelection(selected, 10, "toggle"), []);
  const dragged = [10, 11, 12].reduce((current, index) => updateSlotSelection(current, index, "select"), []);
  assert.deepEqual(dragged, [10, 11, 12]);
  assert.deepEqual([10, 11].reduce((current, index) => updateSlotSelection(current, index, "deselect"), dragged), [12]);
  assert.deepEqual(contiguousSlotRanges([1, 2, 4, 5, 6]), [{ from: 1, to: 2 }, { from: 4, to: 6 }]);
});

test("1時間刻みで10:00から20:00までの候補を作る", () => {
  const slots = createDailySlots();
  assert.equal(slots[0], "10:00");
  assert.equal(slots.at(-1), "20:00");
  assert.equal(slots.length, 11);
});

test("10:00からのレッスン後は11:00から続けて予約できる", () => {
  const existing = [slotRange("2026-08-08", "10:00")];
  const slots = availableSlots("2026-08-08", existing);
  assert.equal(slots.includes("10:00"), false);
  assert.equal(slots.includes("11:00"), true);
});

test("予約できない時間も同じ位置に予約ありとして残す", () => {
  const blocked = [{ start: new Date("2026-08-08T10:30:00+09:00"), end: new Date("2026-08-08T12:30:00+09:00") }];
  const schedule = slotAvailability("2026-08-08", [], blocked);
  assert.equal(schedule.length, 11);
  assert.deepEqual(schedule.find((slot) => slot.time === "10:00"), { time: "10:00", available: false });
  assert.deepEqual(schedule.find((slot) => slot.time === "12:00"), { time: "12:00", available: false });
  assert.deepEqual(schedule.find((slot) => slot.time === "13:00"), { time: "13:00", available: true });
});

test("予約時刻を開始から終了まで表示する", () => {
  assert.equal(formatLessonTimeRange("10:00"), "10:00〜11:00");
  assert.equal(formatLessonTimeRange("20:00"), "20:00〜21:00");
});

test("前のレッスン終了と同時に次のレッスンを開始できる", () => {
  const candidate = slotRange("2026-08-08", "11:00");
  const existing = [slotRange("2026-08-08", "10:00")];
  assert.equal(hasRequiredBuffer(candidate, existing), true);
  assert.equal(hasRequiredBuffer(slotRange("2026-08-08", "10:00"), existing), false);
});

test("連絡ありのキャンセルは返却し、無断キャンセルだけ消化する", () => {
  assert.equal(isCancellationRefundable(false), true);
  assert.equal(isCancellationRefundable(true), false);
});

test("支払い失敗から5日間は既存予約を残し新規予約を許可する", () => {
  const failedAt = new Date("2026-08-01T09:00:00+09:00");
  assert.equal(paymentBookingAllowed(failedAt, new Date("2026-08-06T08:59:59+09:00")), true);
  assert.equal(paymentBookingAllowed(failedAt, new Date("2026-08-06T09:00:00+09:00")), false);
});

test("入会決定日が20日までなら翌月、21日以降なら翌々月開始", () => {
  assert.equal(membershipStartMonth(new Date("2026-07-20T23:59:00+09:00")), "2026-08-01");
  assert.equal(membershipStartMonth(new Date("2026-07-21T00:00:00+09:00")), "2026-09-01");
  assert.equal(membershipStartMonth(new Date("2026-12-21T12:00:00+09:00")), "2027-02-01");
});
