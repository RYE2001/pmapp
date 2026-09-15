import { Task } from "../api/client";

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  LOW: "#9AA0A6",
  MEDIUM: "#C98A2B",
  HIGH: "#B3452C",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isOverdue(task: Task) {
  return task.status !== "DONE" && task.dueDate && new Date(task.dueDate) < new Date();
}

export default function TaskCard({
  task,
  onClick,
  onDragStart,
}: {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-surface border border-border rounded-md p-3 cursor-pointer hover:border-accent/60 hover:shadow-sm transition-all active:cursor-grabbing"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono text-ink-soft">#{task.id.slice(0, 6)}</span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
          title={`${task.priority} priority`}
        />
      </div>
      <p className="text-sm leading-snug">{task.title}</p>
      {task.activeBlocker?.isExternal && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[#B3452C] bg-[#B3452C]/10 border border-[#B3452C]/30 rounded px-1.5 py-0.5">
          Needs admin — external blocker
        </div>
      )}
      <div className="flex items-center justify-between mt-3">
        {task.assignee ? (
          <div
            className="w-6 h-6 rounded-full bg-accent-soft text-accent text-[10px] font-medium flex items-center justify-center"
            title={task.assignee.name}
          >
            {initials(task.assignee.name)}
          </div>
        ) : (
          <span className="text-[11px] text-ink-soft">Unassigned</span>
        )}
        <div className="flex items-center gap-2">
          {task._count?.timeEntries ? (
            <span className="text-[11px] font-mono text-ink-soft">{task._count.timeEntries} logs</span>
          ) : null}
          {task.dueDate && (
            <span className={`text-[11px] font-mono ${isOverdue(task) ? "text-[#B3452C]" : "text-ink-soft"}`}>
              {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
