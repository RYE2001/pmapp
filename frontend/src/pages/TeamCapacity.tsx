import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { api, TeamCapacity as TeamCapacityData } from "../api/client";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function mondayOf(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return monday;
}

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
}

export default function TeamCapacity() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState<TeamCapacityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getTeamCapacity(dayKey(weekStart)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team capacity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [weekStart]);

  const totals = useMemo(() => ({
    capacity: data?.people.reduce((sum, person) => sum + person.capacityMinutes, 0) ?? 0,
    planned: data?.people.reduce((sum, person) => sum + person.plannedMinutes, 0) ?? 0,
    actual: data?.people.reduce((sum, person) => sum + person.actualMinutes, 0) ?? 0,
    overloaded: data?.people.filter((person) => person.isOverloaded).length ?? 0,
  }), [data]);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);

  return <Layout><div className="max-w-7xl mx-auto px-8 py-8">
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-7"><div><p className="text-xs font-mono text-ink-soft uppercase tracking-wide">Resource planning</p><h1 className="font-display text-2xl font-semibold mt-1">Team capacity</h1><p className="text-ink-soft text-sm mt-1">See planned work, actual effort, availability, and overload across your project teams.</p></div><div className="flex items-center gap-2"><button onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7))} className="border border-border rounded px-2.5 py-1.5 text-sm hover:border-accent">←</button><button onClick={() => setWeekStart(mondayOf(new Date()))} className="border border-border rounded px-2.5 py-1.5 text-sm hover:border-accent">This week</button><button onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7))} className="border border-border rounded px-2.5 py-1.5 text-sm hover:border-accent">→</button></div></div>
    <p className="text-sm font-medium mb-5">{weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
    {error && <div className="mb-5 border border-[#B3452C]/40 bg-[#B3452C]/10 rounded-lg px-4 py-3 text-sm text-[#B3452C]">{error}</div>}
    {loading || !data ? <p className="text-sm text-ink-soft">Loading team capacity…</p> : <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7"><div className="border border-border rounded-lg p-4 bg-surface"><p className="text-xs text-ink-soft">Available capacity</p><p className="font-display text-2xl mt-1">{hours(totals.capacity)}</p></div><div className="border border-border rounded-lg p-4 bg-surface"><p className="text-xs text-ink-soft">Planned work</p><p className="font-display text-2xl mt-1">{hours(totals.planned)}</p></div><div className="border border-border rounded-lg p-4 bg-surface"><p className="text-xs text-ink-soft">Actual time</p><p className="font-display text-2xl mt-1">{hours(totals.actual)}</p></div><div className={`border rounded-lg p-4 ${totals.overloaded ? "border-[#B3452C]/40 bg-[#B3452C]/10" : "border-border bg-surface"}`}><p className="text-xs text-ink-soft">Overloaded people</p><p className={`font-display text-2xl mt-1 ${totals.overloaded ? "text-[#B3452C]" : ""}`}>{totals.overloaded}</p></div></div>
      {data.people.length === 0 ? <div className="border border-dashed border-border rounded-lg p-10 text-center text-sm text-ink-soft">Join or create a project to see team capacity.</div> : <div className="space-y-3">{data.people.map((person) => <article key={person.id} className={`border rounded-lg p-4 bg-surface ${person.isOverloaded ? "border-[#B3452C]/50" : "border-border"}`}><div className="flex flex-col lg:flex-row lg:items-center gap-4"><div className="w-44 shrink-0"><h2 className="font-medium">{person.name}</h2><p className="text-xs text-ink-soft truncate">{person.email}</p></div><div className="flex-1 min-w-0"><div className="flex items-center justify-between text-xs mb-1.5"><span className={person.isOverloaded ? "text-[#B3452C] font-medium" : "text-ink-soft"}>{person.isOverloaded ? "Overloaded" : "Workload"}</span><span className="font-mono">{person.workloadPercent}%</span></div><div className="h-2 rounded-full bg-paper overflow-hidden"><div className={`h-full rounded-full ${person.isOverloaded ? "bg-[#B3452C]" : "bg-accent"}`} style={{ width: `${Math.min(person.workloadPercent, 100)}%` }} /></div></div><div className="grid grid-cols-3 gap-4 text-right shrink-0"><div><p className="text-[11px] text-ink-soft">Capacity</p><p className="text-sm font-medium">{hours(person.capacityMinutes)}</p></div><div><p className="text-[11px] text-ink-soft">Planned</p><p className="text-sm font-medium">{hours(person.plannedMinutes)}</p></div><div><p className="text-[11px] text-ink-soft">Actual</p><p className="text-sm font-medium">{hours(person.actualMinutes)}</p></div></div></div>{person.unavailableMinutes > 0 && <p className="text-xs text-[#C98A2B] mt-3">{hours(person.unavailableMinutes)} unavailable this week</p>}{person.projectAllocations.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{person.projectAllocations.map((allocation) => <span key={allocation.projectId} className="text-xs border border-border rounded px-2 py-1 text-ink-soft">{allocation.name} · {hours(allocation.minutes)}</span>)}</div>}</article>)}</div>}
      {data.plannedVsActual.length > 0 && <section className="mt-8"><div className="mb-3"><h2 className="font-display text-lg font-semibold">Planned vs actual</h2><p className="text-xs text-ink-soft mt-0.5">Task allocations planned for this week compared with logged time.</p></div><div className="border border-border rounded-lg overflow-x-auto"><table className="w-full text-sm"><thead className="bg-paper text-left text-xs text-ink-soft"><tr><th className="px-4 py-3 font-medium">Task</th><th className="px-4 py-3 font-medium text-right">Planned</th><th className="px-4 py-3 font-medium text-right">Actual</th><th className="px-4 py-3 font-medium text-right">Difference</th></tr></thead><tbody>{data.plannedVsActual.map((task) => { const difference = task.actualMinutes - task.plannedMinutes; return <tr key={task.id} className="border-t border-border"><td className="px-4 py-3">{task.title}</td><td className="px-4 py-3 text-right font-mono text-ink-soft">{hours(task.plannedMinutes)}</td><td className="px-4 py-3 text-right font-mono text-ink-soft">{hours(task.actualMinutes)}</td><td className={`px-4 py-3 text-right font-mono ${difference > 0 ? "text-[#B3452C]" : "text-accent"}`}>{difference > 0 ? "+" : ""}{hours(difference)}</td></tr>; })}</tbody></table></div></section>}
    </>}
  </div></Layout>;
}
