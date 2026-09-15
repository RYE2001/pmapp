import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api, Decision, DecisionStatus, ProjectDetail, Task } from "../api/client";

const statusLabel: Record<DecisionStatus, string> = {
  ACTIVE: "Active",
  SUPERSEDED: "Superseded",
  REVERSED: "Reversed",
};

export default function ProjectMemory() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [rationale, setRationale] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const [decidedAt, setDecidedAt] = useState("");
  const [peopleIds, setPeopleIds] = useState<string[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [evidenceText, setEvidenceText] = useState("");

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [projectData, taskData, decisionData] = await Promise.all([
        api.getProject(id),
        api.listTasks(id),
        api.listDecisions(id),
      ]);
      setProject(projectData);
      setTasks(taskData);
      setDecisions(decisionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load project memory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const evidence = evidenceText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf("|");
          return separator === -1
            ? { label: line }
            : { label: line.slice(0, separator).trim(), url: line.slice(separator + 1).trim() };
        });
      await api.createDecision(id, {
        title,
        summary,
        rationale,
        alternatives,
        decidedAt: decidedAt || undefined,
        peopleIds,
        taskIds,
        evidence,
      });
      setTitle("");
      setSummary("");
      setRationale("");
      setAlternatives("");
      setDecidedAt("");
      setPeopleIds([]);
      setTaskIds([]);
      setEvidenceText("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save decision");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(decision: Decision, status: DecisionStatus) {
    try {
      const updated = await api.updateDecisionStatus(decision.id, status);
      setDecisions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update decision");
    }
  }

  if (loading || !project) {
    return <Layout><div className="px-8 py-10 text-sm text-ink-soft">Loading project memory…</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <Link to={`/projects/${project.id}`} className="text-xs text-ink-soft hover:text-ink">← Back to board</Link>
            <p className="text-xs font-mono text-ink-soft uppercase tracking-wide mt-5">Project memory</p>
            <h1 className="font-display text-2xl font-semibold mt-1">Why this project looks the way it does</h1>
            <p className="text-ink-soft text-sm mt-1">Decisions, reasoning, evidence, and consequences in one place.</p>
          </div>
          <button
            onClick={() => setShowForm((current) => !current)}
            className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent transition-colors shrink-0"
          >
            {showForm ? "Close form" : "Record decision"}
          </button>
        </div>

        {error && <div className="mb-5 border border-[#B3452C]/40 bg-[#B3452C]/10 rounded-lg px-4 py-3 text-sm text-[#B3452C]">{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} className="mb-8 border border-border rounded-lg p-5 bg-surface space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm text-ink-soft">Decision title<input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="PLC communication architecture" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" /></label>
              <label className="text-sm text-ink-soft">Decision date<input type="date" value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" /></label>
            </div>
            <label className="block text-sm text-ink-soft">What was decided<textarea required rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" placeholder="Use supplier A for the control cabinet." /></label>
            <label className="block text-sm text-ink-soft">Why<textarea required rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" placeholder="Supplier A supports the required Modbus TCP integration." /></label>
            <label className="block text-sm text-ink-soft">Alternatives considered<textarea rows={2} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" placeholder="Supplier B was cheaper but lacked the required protocol." /></label>

            <div>
              <p className="text-sm text-ink-soft mb-2">People involved</p>
              <div className="flex flex-wrap gap-2">{project.members.map((member) => <label key={member.user.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={peopleIds.includes(member.user.id)} onChange={() => toggle(setPeopleIds, member.user.id)} />{member.user.name}</label>)}</div>
            </div>
            <div>
              <p className="text-sm text-ink-soft mb-2">Related tasks</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">{tasks.map((task) => <label key={task.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taskIds.includes(task.id)} onChange={() => toggle(setTaskIds, task.id)} />{task.title}</label>)}</div>
            </div>
            <label className="block text-sm text-ink-soft">Evidence, one per line<textarea rows={3} value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" placeholder="Quote #1842 | https://example.com/quote-1842" /></label>
            <button disabled={saving} className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent disabled:opacity-50">{saving ? "Saving…" : "Save decision"}</button>
          </form>
        )}

        {decisions.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-10 text-center"><p className="text-ink-soft text-sm">No decisions recorded yet.</p><p className="text-ink-soft text-xs mt-1">Capture the reasoning before it disappears into a meeting thread.</p></div>
        ) : (
          <div className="space-y-4">{decisions.map((decision) => (
            <article key={decision.id} className="border border-border rounded-lg bg-surface p-5">
              <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-display text-lg font-semibold">{decision.title}</h2><span className="text-[11px] font-mono text-ink-soft border border-border rounded px-1.5 py-0.5">{statusLabel[decision.status]}</span></div><p className="text-xs text-ink-soft mt-1">{new Date(decision.decidedAt).toLocaleDateString()} · recorded by {decision.createdBy.name}</p></div><select value={decision.status} onChange={(e) => changeStatus(decision, e.target.value as DecisionStatus)} className="rounded-md border border-border px-2 py-1 text-xs bg-surface"><option value="ACTIVE">Active</option><option value="SUPERSEDED">Superseded</option><option value="REVERSED">Reversed</option></select></div>
              <div className="mt-4 space-y-3 text-sm"><div><p className="text-xs font-mono uppercase text-ink-soft">Decision</p><p className="mt-1">{decision.summary}</p></div><div><p className="text-xs font-mono uppercase text-ink-soft">Why</p><p className="mt-1 whitespace-pre-wrap">{decision.rationale}</p></div>{decision.alternatives && <div><p className="text-xs font-mono uppercase text-ink-soft">Alternatives</p><p className="mt-1 whitespace-pre-wrap">{decision.alternatives}</p></div>}</div>
              {decision.taskLinks.length > 0 && <div className="mt-4"><p className="text-xs font-mono uppercase text-ink-soft mb-1.5">Impacted tasks</p><div className="flex flex-wrap gap-2">{decision.taskLinks.map((link) => <span key={link.task.id} className="text-xs border border-border rounded px-2 py-1">{link.task.title}</span>)}</div></div>}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">{decision.people.length > 0 && <span>People: {decision.people.map((person) => person.user.name).join(", ")}</span>}{decision.evidence.length > 0 && <span>Evidence: {decision.evidence.map((item) => item.url ? <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-accent hover:underline mr-2">{item.label}</a> : <span key={item.id} className="mr-2">{item.label}</span>)}</span>}</div>
            </article>
          ))}</div>
        )}
      </div>
    </Layout>
  );
}