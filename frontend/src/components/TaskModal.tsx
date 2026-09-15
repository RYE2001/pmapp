import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api, Blocker, Task, TaskActivity, TaskAssignment, TaskComment, TimeEntry, User } from "../api/client";

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

function dateTimeInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function durationLabel(startsAt: string, endsAt: string) {
  const minutes = Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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

  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskCommentText, setTaskCommentText] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [plannedUserId, setPlannedUserId] = useState("");
  const [plannedStartsAt, setPlannedStartsAt] = useState(() => dateTimeInput(new Date()));
  const [plannedEndsAt, setPlannedEndsAt] = useState(() => dateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    if (task) {
      api.listTimeEntries(task.id).then(setEntries);
      api.listTaskComments(task.id).then(setTaskComments);
      api.listTaskActivity(task.id).then(setActivity);
      api.listTaskAssignments(task.id).then(setAssignments);
    }
    if (task && task.status === "BLOCKED") {
      setBlockerLoading(true);
      api
        .getBlocker(task.id)
        .then((res) => setBlocker(res.blocker))
        .finally(() => setBlockerLoading(false));
    }
  }, [task]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return members
      .filter((member) => member.user.name.toLowerCase().includes(query) || member.user.email.toLowerCase().includes(query))
      .slice(0, 5);
  }, [members, mentionQuery]);

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

  function handleTaskCommentChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const nextText = e.target.value;
    setTaskCommentText(nextText);
    const match = nextText.match(/(?:^|\s)@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function addMention(member: Props["members"][number]) {
    setTaskCommentText((current) => {
      const match = current.match(/(?:^|\s)@[^\s@]*$/);
      if (!match) return current;
      const beforeMention = current.slice(0, current.length - match[0].length);
      const leadingSpace = match[0].startsWith(" ") ? " " : "";
      return `${beforeMention}${leadingSpace}@${member.user.name} `;
    });
    setMentionedUserIds((ids) => (ids.includes(member.user.id) ? ids : [...ids, member.user.id]));
    setMentionQuery(null);
  }

  async function handleAddTaskComment(e: FormEvent) {
    e.preventDefault();
    if (!task || !taskCommentText.trim()) return;

    // Only send mentions still present in the message, so edited-out selections are never retained.
    const activeMentionIds = mentionedUserIds.filter((id) => {
      const name = members.find((member) => member.user.id === id)?.user.name;
      return !!name && taskCommentText.includes(`@${name}`);
    });
    const result = await api.addTaskComment(task.id, taskCommentText.trim(), activeMentionIds);
    setTaskComments((comments) => [...comments, result.comment]);
    setActivity((items) => [result.activity, ...items]);
    setTaskCommentText("");
    setMentionedUserIds([]);
    setMentionQuery(null);
  }

  async function handlePlanAssignment(e: FormEvent) {
    e.preventDefault();
    if (!task || !plannedUserId) return;
    setPlanning(true);
    try {
      const assignment = await api.createTaskAssignment(task.id, {
        userId: plannedUserId,
        startsAt: plannedStartsAt,
        endsAt: plannedEndsAt,
      });
      setAssignments((items) => [...items, assignment]);
      setPlannedUserId("");
    } finally {
      setPlanning(false);
    }
  }

  async function handleDeleteAssignment(assignmentId: string) {
    if (!confirm("Remove this planned allocation?")) return;
    setPlanning(true);
    try {
      await api.deleteTaskAssignment(assignmentId);
      setAssignments((items) => items.filter((item) => item.id !== assignmentId));
    } finally {
      setPlanning(false);
    }
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
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium">Conversation</h3>
                <p className="text-xs text-ink-soft mt-0.5">Type @ to mention a teammate.</p>
              </div>
              {taskComments.length > 0 && <span className="text-xs font-mono text-ink-soft">{taskComments.length}</span>}
            </div>

            <div className="space-y-3 max-h-52 overflow-y-auto pr-1 mb-3">
              {taskComments.map((comment) => (
                <div key={comment.id} className="border border-border rounded-md px-3 py-2.5 bg-paper/40">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-sm font-medium">{comment.author.name}</span>
                    <span className="text-[11px] text-ink-soft shrink-0">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{comment.message}</p>
                  {comment.mentions.length > 0 && (
                    <p className="text-xs text-accent mt-2">
                      Mentioned {comment.mentions.map((mention) => mention.user.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
              {taskComments.length === 0 && (
                <p className="text-xs text-ink-soft">No comments yet. Start the conversation for this task.</p>
              )}
            </div>

            <form onSubmit={handleAddTaskComment} className="relative">
              <textarea
                rows={2}
                maxLength={2000}
                value={taskCommentText}
                onChange={handleTaskCommentChange}
                placeholder="Write a comment…"
                className="w-full rounded-md border border-border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
              />
              {mentionQuery !== null && mentionSuggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 bottom-full mb-1 rounded-md border border-border bg-surface shadow-sm overflow-hidden">
                  {mentionSuggestions.map((member) => (
                    <button
                      key={member.user.id}
                      type="button"
                      onClick={() => addMention(member)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-paper flex items-center justify-between gap-3"
                    >
                      <span>{member.user.name}</span>
                      <span className="text-xs text-ink-soft truncate">{member.user.email}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:border-accent transition-colors"
                >
                  Comment
                </button>
              </div>
            </form>
          </div>
        )}

        {isEditing && (
          <div className="px-6 py-5 border-t border-border bg-paper/35">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium">Resource plan</h3>
                <p className="text-xs text-ink-soft mt-0.5">Schedule teammate time; it appears on their timeline and in team capacity.</p>
              </div>
              {assignments.length > 0 && <span className="text-xs font-mono text-ink-soft">{assignments.length}</span>}
            </div>
            <div className="space-y-2 mb-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between gap-3 border border-border rounded-md px-3 py-2 text-sm bg-surface">
                  <div className="min-w-0">
                    <span className="font-medium">{assignment.user.name}</span>
                    {assignment.timeBlock && <span className="text-ink-soft"> · {new Date(assignment.timeBlock.startsAt).toLocaleString()} · {durationLabel(assignment.timeBlock.startsAt, assignment.timeBlock.endsAt)}</span>}
                  </div>
                  <button type="button" disabled={planning} onClick={() => handleDeleteAssignment(assignment.id)} className="text-xs text-[#B3452C] hover:underline shrink-0">Remove</button>
                </div>
              ))}
              {assignments.length === 0 && <p className="text-xs text-ink-soft">No time is planned for this task yet.</p>}
            </div>
            <form onSubmit={handlePlanAssignment} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select required value={plannedUserId} onChange={(e) => setPlannedUserId(e.target.value)} className="rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface"><option value="">Plan a teammate…</option>{members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}</select>
              <div className="flex gap-2"><input required type="datetime-local" value={plannedStartsAt} onChange={(e) => setPlannedStartsAt(e.target.value)} className="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 text-xs bg-surface" /><input required type="datetime-local" value={plannedEndsAt} onChange={(e) => setPlannedEndsAt(e.target.value)} className="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 text-xs bg-surface" /></div>
              <button disabled={planning || !plannedUserId} className="sm:col-span-2 text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:border-accent transition-colors bg-surface disabled:opacity-50">{planning ? "Saving…" : "Add planned allocation"}</button>
            </form>
          </div>
        )}

        {isEditing && (
          <div className="px-6 py-5 border-t border-border bg-paper/35">
            <h3 className="text-sm font-medium mb-3">Activity</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {activity.map((item) => (
                <div key={item.id} className="text-sm">
                  <span className="font-medium">{item.actor.name}</span>{" "}
                  <span className="text-ink-soft">{item.summary}</span>
                  <span className="text-[11px] text-ink-soft ml-2">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              ))}
              {activity.length === 0 && <p className="text-xs text-ink-soft">Activity will appear as the task changes.</p>}
            </div>
          </div>
        )}

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
