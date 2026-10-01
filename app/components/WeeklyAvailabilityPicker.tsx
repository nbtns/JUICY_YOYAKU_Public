"use client";

import { useEffect, useMemo, useState } from "react";
import { createDailySlots } from "@/lib/booking";

type AvailabilityResponse = {
  date: string;
  slots?: string[];
  schedule?: { time: string; available: boolean }[];
  error?: string;
};

type DayAvailability = {
  date: string;
  schedule: Record<string, boolean>;
  error?: string;
};

type WeeklyAvailabilityPickerProps = {
  initialStartDate: string;
  selectedDate: string;
  selectedTime: string;
  refreshKey?: number;
  onSelect: (date: string, time: string) => void;
  onClearSelection?: () => void;
};

export function WeeklyAvailabilityPicker({
  initialStartDate,
  selectedDate,
  selectedTime,
  refreshKey = 0,
  onSelect,
  onClearSelection,
}: WeeklyAvailabilityPickerProps) {
  const [weekStart, setWeekStart] = useState(initialStartDate);
  const [loadedWeek, setLoadedWeek] = useState<{ key: string; days: DayAvailability[] }>({ key: "", days: [] });
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const times = useMemo(() => createDailySlots(), []);
  const requestKey = `${weekStart}:${refreshKey}`;
  const loading = loadedWeek.key !== requestKey;
  const days = loading ? [] : loadedWeek.days;

  useEffect(() => {
    let active = true;
    Promise.all(dates.map(async (date) => {
      try {
        const response = await fetch(`/api/reservations/availability?date=${encodeURIComponent(date)}`);
        const body = await response.json() as AvailabilityResponse;
        if (!response.ok) return { date, schedule: {}, error: body.error ?? "受付期間外です" };
        const schedule = body.schedule ?? times.map((time) => ({ time, available: body.slots?.includes(time) ?? false }));
        return { date, schedule: Object.fromEntries(schedule.map((slot) => [slot.time, slot.available])) };
      } catch {
        return { date, schedule: {}, error: "空き状況を取得できませんでした" };
      }
    })).then((nextDays) => {
      if (active) setLoadedWeek({ key: requestKey, days: nextDays });
    });
    return () => { active = false; };
  }, [dates, requestKey, times]);

  function changeWeek(nextStart: string) {
    const clamped = nextStart < initialStartDate ? initialStartDate : nextStart;
    setWeekStart(clamped);
    onClearSelection?.();
  }

  return (
    <section className="weekly-availability" aria-labelledby="weeklyAvailabilityTitle">
      <div className="weekly-availability-heading">
        <div>
          <p className="eyebrow">WEEKLY AVAILABILITY</p>
          <h3 id="weeklyAvailabilityTitle">予約日時を選択</h3>
          <p>○の時間を押すと予約日時を選べます。レッスンは1枠60分です。</p>
        </div>
        <div className="weekly-availability-controls">
          <button type="button" onClick={() => changeWeek(initialStartDate)}>直近の空き状況</button>
          <label>表示開始日<input type="date" min={initialStartDate} value={weekStart} onChange={(event) => changeWeek(event.target.value)} /></label>
          <button type="button" disabled={weekStart <= initialStartDate} onClick={() => changeWeek(addDays(weekStart, -7))}>‹ 前週</button>
          <button type="button" onClick={() => changeWeek(addDays(weekStart, 7))}>翌週 ›</button>
        </div>
      </div>

      <div className="weekly-table-scroll" aria-live="polite" aria-busy={loading}>
        <table className="weekly-table">
          <thead>
            <tr>
              <th scope="col">時間</th>
              {dates.map((date) => <th className={weekdayClass(date)} scope="col" key={date}>{formatDateHeading(date)}</th>)}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time}>
                <th scope="row">{time}</th>
                {dates.map((date, dayIndex) => {
                  const day = days[dayIndex];
                  const available = day?.schedule[time] ?? false;
                  const selected = available && selectedDate === date && selectedTime === time;
                  const label = `${formatAccessibleDate(date)} ${time} ${available ? "予約できます" : day?.error ?? "予約できません"}`;
                  return (
                    <td key={date}>
                      <button
                        className={`weekly-cell ${available ? "available" : "unavailable"}${selected ? " selected" : ""}`}
                        type="button"
                        disabled={!available || loading}
                        aria-label={label}
                        aria-pressed={selected}
                        onClick={() => onSelect(date, time)}
                      >
                        {loading ? "…" : available ? "○" : "×"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="weekly-legend"><span><b className="available-mark">○</b> 予約できます</span><span><b>×</b> 予約済み・受付時間外</span>{selectedDate && selectedTime && <strong>選択中：{formatAccessibleDate(selectedDate)} {selectedTime}〜</strong>}</div>
    </section>
  );
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateHeading(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00+09:00`));
}

function formatAccessibleDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00+09:00`));
}

function weekdayClass(value: string) {
  const day = new Date(`${value}T12:00:00+09:00`).getDay();
  return day === 0 ? "sunday" : day === 6 ? "saturday" : "";
}
