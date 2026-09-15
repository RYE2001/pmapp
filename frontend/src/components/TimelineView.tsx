import { useMemo } from "react";
import { Task, TaskStatus } from "../api/client";

const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "#9AA0A6",
  IN_PROGRESS: "#C98A2B",
  BLOCKED: "#B3452C",
  DONE: "#2F5D50",
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const PX_PER_DAY = 36;
const ROW_HEIGHT = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export default function TimelineView({
  tasks,
  onTaskClick,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}) {
  const dated = tasks.filter((t) => t.startDate || t.dueDate);
  const undated = tasks.filter((t) => !t.startDate && !t.dueDate);

  const { rangeStart, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    if (dated.length === 0) {
      return { rangeStart: today, totalDays: 21 };
    }
    let min = today;
    let max = today;
    for (const t of dated) {
      const s = t.startDate ? startOfDay(new Date(t.startDate)) : null;
      const e = t.dueDate ? startOfDay(new Date(t.dueDate)) : null;
      if (s && s < min) min = s;
      if (e && e < min) min = e;
      if (s && s > max) max = s;
      if (e && e > max) max = e;
    }
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 3);
    return { rangeStart: min, totalDays: Math.max(daysBetween(min, max), 10) };
  }, [dated]);

  const totalWidth = totalDays * PX_PER_DAY;
  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = startOfDay(new Date());
  const todayOffset = daysBetween(rangeStart, today) * PX_PER_DAY;
  const todayInRange = todayOffset >= 0 && todayOffset <= totalWidth;

  const sorted = [...dated].sort((a, b) => {
    const aTime = new Date(a.startDate ?? a.dueDate!).getTime();
    const bTime = new Date(b.startDate ?? b.dueDate!).getTime();
    return aTime - bTime;
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs text-ink-soft">
        {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]}
          </div>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-ink-soft text-sm">
            No tasks have a start or due date yet. Open a task and set one to see it here.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-surface overflow-hidden flex">
          <div className="w-48 shrink-0 border-r border-border">
            <div style={{ height: ROW_HEIGHT }} className="border-b border-border" />
            {sorted.map((task) => (
              <button
                key={task.id}
                onClick={() => onTaskClick(task)}
                style={{ height: ROW_HEIGHT }}
                className="w-full flex items-center gap-2 px-3 border-b border-border/60 last:border-b-0 text-left hover:bg-paper transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLOR[task.status] }}
                />
                <span className="text-sm truncate">{task.title}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-x-auto">
            <div style={{ width: totalWidth }} className="relative">
              <div className="flex border-b border-border" style={{ height: ROW_HEIGHT }}>
                {days.map((d, i) => (
                  <div
                    key={i}
                    style={{ width: PX_PER_DAY }}
                    className={`shrink-0 flex items-center justify-center text-[10px] font-mono border-r border-border/40 ${
                      d.getDay() === 0 || d.getDay() === 6 ? "bg-paper" : ""
                    } text-ink-soft`}
                  >
                    {i === 0 || d.getDate() === 1
                      ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : d.getDate()}
                  </div>
                ))}
              </div>

              {sorted.map((task) => {
                const start = task.startDate
                  ? startOfDay(new Date(task.startDate))
                  : startOfDay(new Date(task.dueDate!));
                const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : start;
                const barLeft = Math.max(daysBetween(rangeStart, start), 0) * PX_PER_DAY;
                const barWidth = Math.max(daysBetween(start, end) + 1, 1) * PX_PER_DAY;

                return (
                  <div
                    key={task.id}
                    style={{ height: ROW_HEIGHT }}
                    className="border-b border-border/60 last:border-b-0 relative"
                  >
                    <button
                      onClick={() => onTaskClick(task)}
                      title={task.title}
                      style={{
                        left: barLeft + 2,
                        width: barWidth - 4,
                        top: 7,
                        height: ROW_HEIGHT - 14,
                        backgroundColor: STATUS_COLOR[task.status],
                      }}
                      className="absolute rounded text-[11px] text-white px-2 flex items-center truncate opacity-90 hover:opacity-100 transition-opacity"
                    >
                      {barWidth > 70 ? task.title : ""}
                    </button>
                  </div>
                );
              })}

              {todayInRange && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#B3452C]/60 pointer-events-none"
                  style={{ left: todayOffset }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {undated.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-medium mb-2">No dates set</h3>
          <div className="space-y-1.5">
            {undated.map((t) => (
              <button
                key={t.id}
                onClick={() => onTaskClick(t)}
                className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink w-full text-left"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[t.status] }} />
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
