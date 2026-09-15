import { FormEvent, useEffect, useState } from "react";
import { api, Blocker, Task, TimeEntry, User } from "../api/client";

interface Props {
  projectId: string;
  members: { id: string; user: User }[];
  task: Task | null;
  defaultStatus?: Task["status"];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onBlockerChanged: () => void;
}

export default function TaskModal({
  projectId,
  members,
  task,
  defaultStatus,
  onClose,
  onSaved,
  onDeleted,
  onBlockerChanged,
}: Props) {
  const isEditing = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<Task["status"]>(task?.status ?? defaultStatus ?? "TODO");
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ?? "");
  const [startDate, setStartDate] = useState(task?.startDate ? task.startDate.slice(0, 10) : "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");

  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [blockerLoading, setBlockerLoading] = useState(false);
  const [blockerReason, setBlockerReason] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (task) {
      api.listTimeEntries(task.id).then(setEntries);
    }
    if (task && task.status === "BLOCKED") {
      setBlockerLoading(true);
      api
        .getBlocker(task.id)
        .then((res) => setBlocker(res.blocker))
        .finally(() => setBlockerLoading(false));
    }
  }, [task]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title,
      description: description || null,
      priority,
      status,
      assigneeId: assigneeId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
    };
    if (isEditing) {
      await api.updateTask(task!.id, payload);
    } else {
      await api.createTask(projectId, payload);
    }
    setSaving(false);
    onSaved();
  }

  async function handleLogTime(e: FormEvent) {
    e.preventDefault();
    const mins = Number(minutes);
    if (!mins || mins <= 0 || !task) return;
    const entry = await api.logTime(task.id, mins, note || undefined);
    setEntries((prev) => [entry, ...prev]);
    setMinutes("");
    setNote("");
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm("Delete this task? This can't be undone.")) return;
    await api.deleteTask(task.id);
    onDeleted();
  }

  async function handleReportBlocker(e: FormEvent) {
    e.preventDefault();
    if (!task || !blockerReason.trim()) return;
    const res = await api.reportBlocker(task.id, blockerReason.trim());
    setBlocker(res.blocker);
    setBlockerReason("");
    setStatus("BLOCKED");
    onBlockerChanged();
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!blocker || !commentText.trim()) return;
    const comment = await api.addBlockerComment(blocker.id, commentText.trim());
    setBlocker({ ...blocker, comments: [...blocker.comments, comment] });
    setCommentText("");
  }

  async function handleFlagExternal() {
    if (!blocker) return;
    const res = await api.updateBlocker(blocker.id, { isExternal: true });
    setBlocker(res.blocker);
    onBlockerChanged();
  }

  async function handleResolveBlocker() {
    if (!blocker) return;
    await api.updateBlocker(blocker.id, { resolved: true });
    setBlocker(null);
    setStatus("IN_PROGRESS");
    onBlockerChanged();
  }

  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-surface rounded-lg border border-border w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{isEditing ? "Edit task" : "New task"}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1.5">Title</label>
            <input
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1.5">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task["status"])}
                className="w-full rounded-md border border-border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
                className="w-full rounded-md border border-border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-ink-soft mb-1.5">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>
          {startDate && dueDate && startDate > dueDate && (
            <p className="text-xs text-[#B3452C]">Start date is after the due date.</p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : isEditing ? "Save changes" : "Create task"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm text-[#B3452C] px-4 py-2 hover:underline"
              >
                Delete task
              </button>
            )}
          </div>
        </form>

        {isEditing && (
          <div className="px-6 py-5 border-t border-border">
            <h3 className="text-sm font-medium mb-1">Time logged</h3>
            <p className="text-xs text-ink-soft font-mono mb-3">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
            </p>

            <form onSubmit={handleLogTime} className="flex gap-2 mb-4">
              <input
                type="number"
                min={1}
                placeholder="Minutes"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-24 rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <input
                placeholder="What did you work on? (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:border-accent transition-colors"
              >
                Log
              </button>
            </form>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">
                    {entry.user.name} &middot; {entry.note || "No note"}
                  </span>
                  <span className="font-mono text-xs text-ink-soft shrink-0 ml-3">{entry.minutes}m</span>
                </div>
              ))}
              {entries.length === 0 && <p className="text-xs text-ink-soft">No time logged yet.</p>}
            </div>
          </div>
        )}

        {isEditing && status === "BLOCKED" && (
          <div className="px-6 py-5 border-t border-border bg-paper/60">
            <h3 className="text-sm font-medium mb-3">Blocker</h3>

            {blockerLoading ? (
              <p className="text-xs text-ink-soft">Loading…</p>
            ) : !blocker ? (
              <form onSubmit={handleReportBlocker} className="space-y-2">
                <p className="text-xs text-ink-soft">
                  What's stopping this task from moving forward? Let the team know so they can help.
                </p>
                <textarea
                  required
                  rows={2}
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  placeholder="e.g. Waiting on API credentials from the vendor"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button
                  type="submit"
                  className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:border-accent transition-colors bg-surface"
                >
                  Report blocker
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="bg-surface border border-border rounded-md p-3">
                  <p className="text-sm">{blocker.reason}</p>
                  <p className="text-[11px] text-ink-soft mt-1.5 font-mono">
                    {blocker.createdBy.name} &middot; {new Date(blocker.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {blocker.isExternal && (
                  <div className="text-xs text-[#B3452C] bg-[#B3452C]/10 border border-[#B3452C]/30 rounded px-2.5 py-1.5">
                    Flagged for admin attention — no fix found within the team yet.
                  </div>
                )}

                <div>
                  <p className="text-xs text-ink-soft mb-1.5">
                    {blocker.comments.length === 0 ? "No suggestions yet — be the first to help." : "Suggestions from the team"}
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {blocker.comments.map((c) => (
                      <div key={c.id} className="text-sm">
                        <span className="text-ink-soft">{c.author.name}:</span> {c.message}
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Suggest a fix…"
                    className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <button
                    type="submit"
                    className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:border-accent transition-colors bg-surface shrink-0"
                  >
                    Reply
                  </button>
                </form>

                <div className="flex items-center gap-3 pt-1">
                  {!blocker.isExternal && (
                    <button
                      type="button"
                      onClick={handleFlagExternal}
                      className="text-xs text-[#B3452C] hover:underline"
                    >
                      No one here can solve it — notify admin
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResolveBlocker}
                    className="text-xs text-accent hover:underline ml-auto"
                  >
                    Mark resolved
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
