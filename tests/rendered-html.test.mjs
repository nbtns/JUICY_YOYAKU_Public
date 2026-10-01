import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("公開トップページに教室・料金・無料体験の導線がある", async () => {
  const [page, layout, styles] = await Promise.all([read("../app/page.tsx"), read("../app/layout.tsx"), read("../app/globals.css")]);
  assert.match(layout, /JUICY ギター教室/);
  assert.match(page, /好きな曲を/);
  assert.match(page, /初回無料体験を予約/);
  assert.match(page, /courses\.map/);
  assert.match(page, /siteConfig\.businessDays/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.doesNotMatch(`${page}${layout}`, /codex-preview|react-loading-skeleton|Starter Project/);
});

test("トップページの紹介文は指定位置で改行し、数字と説明を一行で表示する", async () => {
  const [page, styles] = await Promise.all([read("../app/page.tsx"), read("../app/globals.css")]);
  assert.match(page, /マンツーマン中心のギター教室です。<\/span>/);
  assert.match(page, /初心者も、もう一度始めたい方も歓迎します。<\/span>/);
  assert.match(page, /弾いてみたい曲を目標に、<br \/>必要な基礎/);
  assert.match(page, /1回ごとのフレックス。<br \/>生活に合わせて/);
  assert.match(page, /気心の知れたメンバーと<br \/>最大3人まで/);
  assert.match(page, /楽器を持っていなくても大丈夫。<br \/>今の経験/);
  assert.match(styles, /hero-facts li \{ display: flex;[^}]*white-space: nowrap/);
});

test("無料体験ページは住所と同意項目を表示する", async () => {
  const [page, form, picker] = await Promise.all([read("../app/trial/page.tsx"), read("../app/trial/TrialForm.tsx"), read("../app/components/WeeklyAvailabilityPicker.tsx")]);
  assert.match(page, /架空の会場/);
  assert.match(form, /privacyConsent/);
  assert.match(form, /cancellationConsent/);
  assert.match(form, /WeeklyAvailabilityPicker/);
  assert.match(picker, /api\/reservations\/availability/);
  assert.match(form, /api\/trials/);
});

test("無料体験予約とレッスン予約の導線が分かれている", async () => {
  const [memberPage, memberDashboard, bookingPage, trialPage] = await Promise.all([
    read("../app/member/page.tsx"),
    read("../app/member/MemberDashboard.tsx"),
    read("../app/member/book/page.tsx"),
    read("../app/trial/page.tsx"),
  ]);
  assert.match(memberDashboard, /\/member\/book/);
  assert.doesNotMatch(`${memberPage}${memberDashboard}`, /href="\/trial"/);
  assert.match(bookingPage, /MemberBookingForm/);
  assert.match(bookingPage, /無料体験の申し込みとは別/);
  assert.match(trialPage, /TrialForm/);
});

test("先生はログアウトせずに選んだテスト会員だけをプレビューできる", async () => {
  const [adminDashboard, memberPage, memberDashboard, auth] = await Promise.all([
    read("../app/admin/AdminDashboard.tsx"),
    read("../app/member/page.tsx"),
    read("../app/member/MemberDashboard.tsx"),
    read("../lib/auth.ts"),
  ]);
  assert.match(adminDashboard, /この会員ページを見る/);
  assert.match(adminDashboard, /\/member\?preview=/);
  assert.match(memberPage, /先生用プレビュー|adminPreview/);
  assert.match(memberDashboard, /先生デモのまま会員画面を確認できます/);
  assert.match(auth, /previewStudentId/);
  assert.match(auth, /return \[actor\.previewStudentId\]/);
});

test("予約画面は全時間枠と終了時刻、新しいキャンセル規約を表示する", async () => {
  const [memberForm, trialForm, picker, legal, engine, styles] = await Promise.all([
    read("../app/member/book/MemberBookingForm.tsx"),
    read("../app/trial/TrialForm.tsx"),
    read("../app/components/WeeklyAvailabilityPicker.tsx"),
    read("../app/legal/page.tsx"),
    read("../lib/reservation-engine.ts"),
    read("../app/globals.css"),
  ]);
  assert.match(memberForm, /formatLessonTimeRange/);
  assert.match(trialForm, /WeeklyAvailabilityPicker/);
  assert.doesNotMatch(memberForm, /credit-preview|予約前|予約後/);
  assert.match(memberForm, /無断キャンセルの場合のみ/);
  assert.match(memberForm, /WeeklyAvailabilityPicker/);
  assert.match(picker, /WEEKLY AVAILABILITY/);
  assert.match(picker, /直近の空き状況/);
  assert.match(picker, /○/);
  assert.match(picker, /×/);
  assert.match(engine, /schedule: slotAvailability/);
  assert.match(styles, /\.weekly-table/);
  assert.match(legal, /前後の休憩時間は設けていません/);
});

test("管理画面で1時間単位の時間グラフから予約不可時間を登録できる", async () => {
  const [calendar, blockApi, blockItemApi, styles] = await Promise.all([
    read("../app/admin/calendar/AdminCalendar.tsx"),
    read("../app/api/admin/calendar-blocks/route.ts"),
    read("../app/api/admin/calendar-blocks/[id]/route.ts"),
    read("../app/globals.css"),
  ]);
  assert.match(calendar, /BLOCK_TIMES/);
  assert.match(calendar, /createDailySlots/);
  assert.match(calendar, /選択したNGを保存/);
  assert.doesNotMatch(calendar, /blockReason/);
  assert.match(calendar, />解除<\/button>/);
  assert.doesNotMatch(calendar, /削除理由を入力してください/);
  assert.match(calendar, /表示中の週の登録済みNG/);
  assert.match(calendar, /weekBlockGroups/);
  assert.match(calendar, /予約あり/);
  assert.match(calendar, /NG登録済み/);
  assert.match(calendar, /blockWeekDates\.map/);
  assert.match(calendar, /7日間の予約不可時間/);
  assert.match(calendar, /admin-booking-form/);
  assert.match(calendar, /updateSlotSelection/);
  assert.match(calendar, /onPointerDown/);
  assert.match(calendar, /onPointerEnter/);
  assert.match(calendar, /selectedBlockSlots/);
  assert.match(calendar, /選択をリセット/);
  assert.match(calendar, /contiguousSlotRanges/);
  assert.match(styles, /\.block-timeline/);
  assert.match(styles, /\.block-week-cell\.selected/);
  assert.match(styles, /\.admin-booking-form/);
  assert.match(styles, /touch-action: none/);
  assert.match(blockApi, /Array\.isArray\(body\.ranges\)/);
  assert.match(blockApi, /ranges\.flatMap/);
  assert.match(blockApi, /\|\| "予約不可時間"/);
  assert.match(blockItemApi, /DELETE FROM calendar_blocks WHERE id = \?/);
  assert.doesNotMatch(blockItemApi, /searchParams\.get\("reason"\)/);
  assert.doesNotMatch(blockItemApi, /calendar_block_deleted/);
});
