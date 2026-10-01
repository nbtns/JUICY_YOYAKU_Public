export const siteConfig = {
  name: "JUICY ギター教室",
  shortName: "JUICY",
  tagline: "好きな曲を、あなたの音に。",
  description:
    "弾きたい気持ちを真ん中に置く、マンツーマン中心のギター教室です。初心者も、もう一度始めたい方も歓迎します。",
  businessHours: "10:00〜21:00",
  businessDays: "全日営業（通常休業日なし）",
  address: "東京都サンプル区デモ町1-2-3（架空の住所）",
  mapUrl: "/#access",
  contactUrl: "/trial",
} as const;

export const courses = [
  { key: "flex", label: "フレックス", individual: 4200, group: 2800, unit: "/ 回", popular: false },
  { key: "monthly3", label: "月3回", individual: 11700, group: 7500, unit: "/ 月", popular: false },
  { key: "monthly4", label: "月4回", individual: 15200, group: 9600, unit: "/ 月", popular: true },
  { key: "monthly8", label: "月8回", individual: 28800, group: 18400, unit: "/ 月", popular: false },
] as const;

export const policy = {
  paymentGraceDays: 5,
  remainingReminderDay: 15,
  remainingReminderTime: "10:00",
  lessonReminderTime: "18:00",
  bookingReleaseDay: 21,
  bookingReleaseTime: "09:00",
  lessonMinutes: 60,
  bufferMinutes: 0,
} as const;
