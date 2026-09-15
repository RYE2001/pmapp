import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "../components/Layout";
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";
import TimelineView from "../components/TimelineView";
import { useAuth } from "../context/AuthContext";
import { api, ProjectDetail, Report, Task, TaskStatus } from "../api/client";

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "TODO", label: "To do", color: "#9AA0A6" },
  { key: "IN_PROGRESS", label: "In progress", color: "#C98A2B" },
  { key: "BLOCKED", label: "Blocked", color: "#B3452C" },
  { key: "DONE", label: "Done", color: "#2F5D50" },
];

export default function Board() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultStatus, setModalDefaultStatus] = useState<TaskStatus>("TODO");
  const [report, setReport] = useState<Report | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [view, setView] = useState<"board" | "timeline">("board");

  const load = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    try {
      const [p, t] = await Promise.all([api.getProject(id), api.listTasks(id)]);
      setProject(p);
      setTasks(t);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    let refreshTimer: number | undefined;
    return api.subscribeToProject(id, () => {
      // Coalesce a burst of edits into one quiet background refresh, without disrupting the board.
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => load(false), 150);
    });
  }, [id, load]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { TODO: [], IN_PROGRESS: [], BLOCKED: [], DONE: [] };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  const isAdmin = project?.members.some((m) => m.user.id === user?.id && m.role === "ADMIN") ?? false;
  const externallyBlocked = tasks.filter((t) => t.activeBlocker?.isExternal);

  function openCreate(status: TaskStatus) {
    setModalTask(null);
    setModalDefaultStatus(status);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setModalTask(task);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalTask(null);
  }

  async function handleSaved() {
    closeModal();
    load();
  }

  async function handleDrop(status: TaskStatus, e: React.DragEvent) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    await api.updateTask(taskId, { status });

    if (status === "BLOCKED") {
      setModalTask({ ...task, status });
      setModalOpen(true);
    }
  }

  async function openReport() {
    if (!id) return;
    const data = await api.getReport(id);
    setReport(data);
    setShowReport(true);
  }

  async function handleAddMember() {
    if (!id) return;
    const email = prompt("Teammate's email address:");
    if (!email) return;
    try {
      await api.addMember(id, email);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not add that teammate");
    }
  }

  if (loading || !project) {
    return (
      <Layout>
        <div className="px-8 py-10 text-sm text-ink-soft">Loading board…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-8 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-semibold">{project.name}</h1>
            {project.description && <p className="text-ink-soft text-sm mt-1">{project.description}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => window.location.assign(`/projects/${project.id}/memory`)}
              className="text-sm font-medium px-3.5 py-2 rounded-md border border-border hover:border-accent transition-colors"
            >
              Project memory
            </button>
            <button
              onClick={handleAddMember}
              className="text-sm font-medium px-3.5 py-2 rounded-md border border-border hover:border-accent transition-colors"
            >
              Add teammate
            </button>
            <button
              onClick={openReport}
              className="text-sm font-medium px-3.5 py-2 rounded-md border border-border hover:border-accent transition-colors"
            >
              View report
            </button>
          </div>
        </div>

        {isAdmin && externallyBlocked.length > 0 && (
          <div className="mb-5 border border-[#B3452C]/40 bg-[#B3452C]/10 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-[#B3452C]">
              {externallyBlocked.length === 1
                ? "1 task is blocked on something outside the team"
                : `${externallyBlocked.length} tasks are blocked on something outside the team`}
            </p>
            <div className="mt-1.5 space-y-1">
              {externallyBlocked.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openEdit(t)}
                  className="block text-sm text-ink hover:underline"
                >
                  {t.title} <span className="text-ink-soft">&mdash; {t.activeBlocker?.reason}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5 mb-5 border border-border rounded-md p-0.5 w-fit bg-surface">
          <button
            onClick={() => setView("board")}
            className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
              view === "board" ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`text-sm font-medium px-3 py-1.5 rounded transition-colors ${
              view === "timeline" ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            Timeline
          </button>
        </div>

        {view === "timeline" && <TimelineView tasks={tasks} onTaskClick={openEdit} />}

        {view === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(col.key, e)}
              className="bg-paper rounded-lg border border-border/60 min-h-[400px]"
            >
              <div className="flex items-center justify-between px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="text-xs font-mono text-ink-soft">{grouped[col.key].length}</span>
                </div>
              </div>
              <div className="px-3 space-y-2 pb-3">
                {grouped[col.key].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => openEdit(task)}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                  />
                ))}
                <button
                  onClick={() => openCreate(col.key)}
                  className="w-full text-left text-sm text-ink-soft hover:text-ink px-3 py-2 rounded-md hover:bg-surface transition-colors"
                >
                  + Add task
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {modalOpen && (
        <TaskModal
          projectId={project.id}
          members={project.members}
          task={modalTask}
          defaultStatus={modalDefaultStatus}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleSaved}
          onBlockerChanged={load}
        />
      )}

      {showReport && report && (
        <div
          className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 px-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="bg-surface rounded-lg border border-border w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold">Project report</h2>
              <button onClick={() => setShowReport(false)} className="text-sm text-ink-soft hover:text-ink">
                Close
              </button>
            </div>

            <div className="mb-5">
              <h3 className="text-sm font-medium mb-2">Tasks by status</h3>
              <div className="flex gap-4">
                {COLUMNS.map((col) => (
                  <div key={col.key}>
                    <div className="text-xl font-display font-semibold">
                      {report.tasksByStatus[col.key] ?? 0}
                    </div>
                    <div className="text-xs text-ink-soft">{col.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <h3 className="text-sm font-medium mb-2">Time logged by teammate</h3>
              {report.minutesLoggedByUser.length === 0 ? (
                <p className="text-xs text-ink-soft">No time logged yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {report.minutesLoggedByUser.map((u) => (
                    <div key={u.userId} className="flex justify-between text-sm">
                      <span>{u.name}</span>
                      <span className="font-mono text-xs text-ink-soft">
                        {Math.floor(u.minutes / 60)}h {u.minutes % 60}m
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Overdue tasks</h3>
              {report.overdueTasks.length === 0 ? (
                <p className="text-xs text-ink-soft">Nothing overdue. Good shape.</p>
              ) : (
                <div className="space-y-1.5">
                  {report.overdueTasks.map((t) => (
                    <div key={t.id} className="flex justify-between text-sm">
                      <span className="truncate">{t.title}</span>
                      <span className="font-mono text-xs text-[#B3452C] shrink-0 ml-3">
                        {t.dueDate && new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {report.externalBlockers.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-medium mb-2">Blocked on something external</h3>
                <div className="space-y-1.5">
                  {report.externalBlockers.map((b) => (
                    <div key={b.taskId} className="text-sm">
                      <span className="truncate">{b.title}</span>
                      <span className="text-ink-soft"> &mdash; {b.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
