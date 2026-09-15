import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api, DeadlineScenario as Scenario, ProjectDetail } from "../api/client";

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
}

function dateInput(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export default function DeadlineScenario() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [deadline, setDeadline] = useState(() => dateInput(14));
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getProject(id)
      .then(setProject)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load project"))
      .finally(() => setLoading(false));
  }, [id]);

  async function runScenario(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setRunning(true);
    setError(null);
    try {
      setScenario(await api.runDeadlineScenario(id, deadline));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate scenario");
    } finally {
      setRunning(false);
    }
  }

  if (loading || !project) {
    return <Layout><div className="px-8 py-10 text-sm text-ink-soft">Loading scenario planner…</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <Link to={`/projects/${project.id}`} className="text-xs text-ink-soft hover:text-ink">← Back to board</Link>
        <div className="mt-5 mb-7">
          <p className="text-xs font-mono text-ink-soft uppercase tracking-wide">Decision support</p>
          <h1 className="font-display text-2xl font-semibold mt-1">What if the deadline moves?</h1>
          <p className="text-ink-soft text-sm mt-1">See the capacity gap and the tradeoffs before changing the plan.</p>
        </div>

        {error && <div className="mb-5 border border-[#B3452C]/40 bg-[#B3452C]/10 rounded-lg px-4 py-3 text-sm text-[#B3452C]">{error}</div>}

        <form onSubmit={runScenario} className="border border-border rounded-lg bg-surface p-5 mb-7 flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="text-sm text-ink-soft flex-1">New deadline<input required type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-ink" /></label>
          <button disabled={running} className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent disabled:opacity-50">{running ? "Calculating…" : "Calculate options"}</button>
        </form>

        {!scenario ? (
          <div className="border border-dashed border-border rounded-lg p-10 text-center"><p className="text-ink-soft text-sm">Choose a date to see the capacity tradeoffs.</p></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
              <div className="border border-border rounded-lg p-4 bg-surface"><p className="text-xs text-ink-soft">Current workload</p><p className="font-display text-2xl mt-1">{hours(scenario.currentWorkloadMinutes)}</p></div>
              <div className="border border-border rounded-lg p-4 bg-surface"><p className="text-xs text-ink-soft">Available capacity</p><p className="font-display text-2xl mt-1">{hours(scenario.availableCapacityMinutes)}</p></div>
              <div className={`border rounded-lg p-4 ${scenario.deficitMinutes ? "border-[#B3452C]/40 bg-[#B3452C]/10" : "border-border bg-surface"}`}><p className="text-xs text-ink-soft">Deficit</p><p className={`font-display text-2xl mt-1 ${scenario.deficitMinutes ? "text-[#B3452C]" : ""}`}>{hours(scenario.deficitMinutes)}</p></div>
              <div className="border border-border rounded-lg p-4 bg-surface"><p className="text-xs text-ink-soft">Planning horizon</p><p className="font-display text-2xl mt-1">{scenario.horizonWeeks}w</p></div>
            </div>

            <h2 className="font-display text-lg font-semibold mb-3">Possible solutions</h2>
            <div className="space-y-3">
              {scenario.options.movePeople.map((option) => <article key={option.person.id} className="border border-border rounded-lg bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">Move {option.person.name}</h3><p className="text-sm text-ink-soft mt-1">{option.explanation}</p></div><span className="font-mono text-sm text-accent">+{hours(option.availableMinutes)}</span></div><p className="text-xs text-ink-soft mt-3">Other project load: {option.projectRiskPercent}% · {option.projectsAffected} project{option.projectsAffected === 1 ? "" : "s"} affected</p></article>)}
              <article className="border border-border rounded-lg bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">External resource</h3><p className="text-sm text-ink-soft mt-1">{scenario.options.externalResource.explanation}</p></div><span className="font-mono text-sm text-accent">+{hours(scenario.options.externalResource.additionalMinutes)}</span></div></article>
              <article className="border border-border rounded-lg bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">Reduce scope</h3><p className="text-sm text-ink-soft mt-1">{scenario.options.reduceScope.fullyCovered ? "These low-priority tasks cover the current deficit." : "Low-priority tasks do not cover the full deficit yet."}</p></div><span className="font-mono text-sm text-accent">-{hours(scenario.options.reduceScope.savedMinutes)}</span></div>{scenario.options.reduceScope.tasks.length > 0 && <div className="mt-3 space-y-1">{scenario.options.reduceScope.tasks.map((task) => <p key={task.id} className="text-xs text-ink-soft">{task.title} · {hours(task.estimatedMinutes)}</p>)}</div>}</article>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
