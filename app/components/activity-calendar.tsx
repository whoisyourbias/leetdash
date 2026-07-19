import type { ActivityCalendarWindow } from "@/lib/activity";
import { formatDateKey } from "@/lib/format";

export function ActivityCalendar({ calendar, label }: { calendar: ActivityCalendarWindow; label: string }) {
  return (
    <div className="activity-calendar" role="group" aria-label={label}>
      {calendar.days.map((day) => {
        const solvedLabel = day.solved === 0 ? "풀이 없음" : `${day.solved}개 풀이`;
        return (
          <time
            className={`activity-day activity-level-${day.intensity}`}
            dateTime={day.date}
            key={day.date}
            title={`${formatDateKey(day.date)}: ${solvedLabel}`}
          >
            <span className="sr-only">{`${formatDateKey(day.date)} ${solvedLabel}`}</span>
          </time>
        );
      })}
    </div>
  );
}
