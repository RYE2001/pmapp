import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api, ProjectSummary } from "../api/client";

export default function Projects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const data = await api.listProjects();
    setProjects(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await api.createProject(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    setShowForm(false);
    setCreating(false);
    load();
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-semibold">Projects</h1>
            <p className="text-ink-soft text-sm mt-1">Everything your teams are running right now.</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors"
          >
            New project
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 border border-border rounded-lg p-5 bg-surface space-y-3"
          >
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">Project name</label>
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="Q4 platform migration"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1.5">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="What is this project for?"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create project"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-ink-soft px-4 py-2 hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-ink-soft text-sm">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-10 text-center">
            <p className="text-ink-soft text-sm">No projects yet. Create the first one to get your team moving.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="block border border-border rounded-lg p-4 bg-surface hover:border-accent transition-colors"
              >
                <div className="flex items-start justify-between">
                  <h2 className="font-medium">{p.name}</h2>
                  <span className="text-[11px] font-mono text-ink-soft border border-border rounded px-1.5 py-0.5">
                    {p.role}
                  </span>
                </div>
                {p.description && (
                  <p className="text-sm text-ink-soft mt-1.5 line-clamp-2">{p.description}</p>
                )}
                <div className="flex gap-4 mt-4 text-xs text-ink-soft font-mono">
                  <span>{p.taskCount} tasks</span>
                  <span>{p.memberCount} members</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
