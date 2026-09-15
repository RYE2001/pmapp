import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";
import { api, MyTask, ProjectDetail, Task } from "../api/client";

export default function MyTasks() {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [modalProject, setModalProject] = useState<ProjectDetail | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTasks(await api.myTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openTask(task: MyTask) {
    try {
      const project = await api.getProject(task.project.id);
      setModalProject(project);
      setModalTask(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this task");
    }
  }

  function closeModal() {
    setModalTask(null);
    setModalProject(null);
  }

  async function refreshAfterChange() {
    closeModal();
    await load();
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="mb-8">
          <p className="text-xs font-mono text-ink-soft uppercase tracking-wide">Across every team</p>
          <h1 className="font-display text-2xl font-semibold mt-1">My tasks</h1>
          <p className="text-ink-soft text-sm mt-1">Your assigned work, with anything blocked brought to the top.</p>
        </div>

        {loading ? (
          <p className="text-ink-soft text-sm">Loading…</p>
        ) : error ? (
          <div className="border border-[#B3452C]/40 bg-[#B3452C]/10 rounded-lg px-4 py-3 text-sm text-[#B3452C]">
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-10 text-center">
            <p className="text-ink-soft text-sm">Nothing is assigned to you yet.</p>
            <p className="text-ink-soft text-xs mt-1">Tasks from all your projects will show up here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-xs text-ink-soft font-mono">
              <span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
              <span>{tasks.filter((task) => task.activeBlocker).length} blocked</span>
              <span>{tasks.filter((task) => task.status === "DONE").length} done</span>
            </div>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
                  <TaskCard
                    task={task}
                    onClick={() => openTask(task)}
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", task.id)}
                  />
                  <span className="text-xs text-ink-soft pt-3 max-w-32 text-right truncate" title={task.project.name}>
                    {task.project.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modalTask && modalProject && (
        <TaskModal
          projectId={modalProject.id}
          members={modalProject.members}
          task={modalTask}
          onClose={closeModal}
          onSaved={refreshAfterChange}
          onDeleted={refreshAfterChange}
          onBlockerChanged={load}
        />
      )}
    </Layout>
  );
}