import { FormEvent, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { api, TimeBlock, TimeBlockKind, TimelineData } from "../api/client";

const KIND_LABELS: Record<TimeBlockKind, string> = {
  WORK: "Work",
  MEETING: "Meeting",
  SUPPORT: "Support",
  OTHER: "Other",
};

const KIND_STYLES: Record<TimeBlockKind, string> = {
  WORK: "border-accent/40 bg-accent/10",
  MEETING: "border-[#705CC8]/35 bg-[#705CC8]/10",
  SUPPORT: "border-[#C98A2B]/40 bg-[#C98A2B]/10",
  OTHER: "border-border bg-paper",
};

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeInput(value: Date | string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function shortDay(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hours(minutes: number) {
  return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;
}

function mondayOf(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return monday;
}

export default function PersonalTimeline() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TimeBlockKind>("WORK");
  const [startsAt, setStartsAt] = useState(() => dateTimeInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => dateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [unavailableStartsAt, setUnavailableStartsAt] = useState(() => dateTimeInput(new Date()));
  const [unavailableEndsAt, setUnavailableEndsAt] = useState(() => dateTimeInput(new Date(Date.now() + 8 * 60 * 60 * 1000)));
  const [unavailableReason, setUnavailableReason] = useState("");
  const [capacityHours, setCapacityHours] = useState("40");

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  }), [weekStart]);

  const selectedProject = timeline?.projects.find((project) => project.id === projectId);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyTimeline(dayKey(weekStart));
      setTimeline(data);
      setCapacityHours(String(data.weeklyCapacityMinutes / 60));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your timeline");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [weekStart]);

  function resetBlockForm(day = days[0]) {
    const start = new Date(day);
    start.setHours(8, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    setEditingBlock(null);
    setTitle("");
    setKind("WORK");
    setStartsAt(dateTimeInput(start));
    setEndsAt(dateTimeInput(end));
    setProjectId("");
    setTaskId("");
  }

  function openNewBlock(day?: Date) {
    resetBlockForm(day);
    setShowBlockForm(true);
  }

  function openEditBlock(block: TimeBlock) {
    setEditingBlock(block);
    setTitle(block.title);
    setKind(block.kind);
    setStartsAt(dateTimeInput(block.startsAt));
    setEndsAt(dateTimeInput(block.endsAt));
    setProjectId(block.project?.id ?? "");
    setTaskId(block.task?.id ?? "");
    setShowBlockForm(true);
  }

  async function handleBlockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = { title: title.trim(), kind, startsAt, endsAt, projectId: projectId || null, taskId: taskId || null };
      if (editingBlock) await api.updateTimeBlock(editingBlock.id, payload);
      else await api.createTimeBlock(payload);
      setShowBlockForm(false);
      resetBlockForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save time block");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlockDelete() {
    if (!editingBlock || !confirm("Delete this time block?")) return;
    setSaving(true);
    try {
      await api.deleteTimeBlock(editingBlock.id);
      setShowBlockForm(false);
      resetBlockForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete time block");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvailabilitySubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createAvailability({ startsAt: unavailableStartsAt, endsAt: unavailableEndsAt, reason: unavailableReason.trim() || undefined });
      setShowAvailabilityForm(false);
      setUnavailableReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save unavailable time");
    } finally {
      setSaving(false);
    }
  }

  async function saveCapacity() {
    const value = Number(capacityHours);
    if (!Number.isFinite(value) || value < 0) return;
    setSaving(true);
    try {
      await api.setWeeklyCapacity(Math.round(value * 60));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update weekly capacity");
    } finally {
      setSaving(false);
    }
  }

  const plannedMinutes = timeline?.blocks.reduce((total, block) => total + Math.max(0, (new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) / 60000), 0) ?? 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-7">
          <div>
            <p className="text-xs font-mono text-ink-soft uppercase tracking-wide">Personal planning</p>
            <h1 className="font-display text-2xl font-semibold mt-1">My timeline</h1>
            <p className="text-ink-soft text-sm mt-1">Plan focused work, meetings, support, and the time you are unavailable.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAvailabilityForm((visible) => !visible)} className="text-sm font-medium px-3.5 py-2 rounded-md border border-border hover:border-accent transition-colors">Add unavailable time</button>
            <button onClick={() => openNewBlock()} className="bg-ink text-white text-sm font-medium px-3.5 py-2 rounded-md hover:bg-accent transition-colors">Plan time block</button>
          </div>
        </div>

        {error && <div className="mb-5 border border-[#B3452C]/40 bg-[#B3452C]/10 rounded-lg px-4 py-3 text-sm text-[#B3452C]">{error}</div>}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7))} className="border border-border rounded px-2.5 py-1.5 text-sm hover:border-accent">←</button>
            <button onClick={() => setWeekStart(mondayOf(new Date()))} className="border border-border rounded px-2.5 py-1.5 text-sm hover:border-accent">This week</button>
            <button onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7))} className="border border-border rounded px-2.5 py-1.5 text-sm hover:border-accent">→</button>
            <span className="text-sm font-medium ml-1">{days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <label>Weekly capacity <input type="number" min={0} value={capacityHours} onChange={(e) => setCapacityHours(e.target.value)} className="ml-1 w-16 border border-border rounded px-2 py-1 text-ink" /> h</label>
            <button disabled={saving} onClick={saveCapacity} className="text-accent hover:underline disabled:opacity-50">Save</button>
          </div>
        </div>

        {showBlockForm && (
          <form onSubmit={handleBlockSubmit} className="mb-6 border border-border rounded-lg p-5 bg-surface space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-medium">{editingBlock ? "Edit time block" : "Plan time block"}</h2><button type="button" onClick={() => setShowBlockForm(false)} className="text-xs text-ink-soft hover:text-ink">Close</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm text-ink-soft">What<input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="PLC debugging" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" /></label>
              <label className="text-sm text-ink-soft">Type<select value={kind} onChange={(e) => setKind(e.target.value as TimeBlockKind)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink bg-surface">{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm text-ink-soft">Start<input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" /></label>
              <label className="text-sm text-ink-soft">End<input required type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink" /></label>
              <label className="text-sm text-ink-soft">Project<select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink bg-surface"><option value="">No project</option>{timeline?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label className="text-sm text-ink-soft">Task <span className="text-xs">(optional)</span><select value={taskId} disabled={!projectId} onChange={(e) => setTaskId(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink bg-surface disabled:opacity-50"><option value="">No task</option>{selectedProject?.tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
            </div>
            {kind === "WORK" && taskId && <p className="text-xs text-accent">This creates a planned task assignment and appears in the team capacity view.</p>}
            <div className="flex items-center gap-3"><button disabled={saving} className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent disabled:opacity-50">{saving ? "Saving…" : editingBlock ? "Save changes" : "Add to timeline"}</button>{editingBlock && <button type="button" disabled={saving} onClick={handleBlockDelete} className="text-sm text-[#B3452C] hover:underline">Delete</button>}</div>
          </form>
        )}

        {showAvailabilityForm && (
          <form onSubmit={handleAvailabilitySubmit} className="mb-6 border border-[#C98A2B]/35 rounded-lg p-5 bg-[#C98A2B]/5 space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="font-medium">Unavailable time</h2><p className="text-xs text-ink-soft mt-0.5">This reduces your available capacity for the week.</p></div><button type="button" onClick={() => setShowAvailabilityForm(false)} className="text-xs text-ink-soft hover:text-ink">Close</button></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><label className="text-sm text-ink-soft">Start<input required type="datetime-local" value={unavailableStartsAt} onChange={(e) => setUnavailableStartsAt(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink bg-surface" /></label><label className="text-sm text-ink-soft">End<input required type="datetime-local" value={unavailableEndsAt} onChange={(e) => setUnavailableEndsAt(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink bg-surface" /></label><label className="text-sm text-ink-soft">Reason <span className="text-xs">(optional)</span><input value={unavailableReason} onChange={(e) => setUnavailableReason(e.target.value)} placeholder="Leave" className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-ink bg-surface" /></label></div>
            <button disabled={saving} className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent disabled:opacity-50">{saving ? "Saving…" : "Save unavailable time"}</button>
          </form>
        )}

        {loading || !timeline ? <p className="text-sm text-ink-soft">Loading timeline…</p> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"><div className="border border-border rounded-lg p-3 bg-surface"><p className="text-xs text-ink-soft">Weekly capacity</p><p className="font-display text-xl mt-1">{hours(timeline.weeklyCapacityMinutes)}</p></div><div className="border border-border rounded-lg p-3 bg-surface"><p className="text-xs text-ink-soft">Planned blocks</p><p className="font-display text-xl mt-1">{hours(Math.round(plannedMinutes))}</p></div><div className="border border-border rounded-lg p-3 bg-surface"><p className="text-xs text-ink-soft">Unavailable</p><p className="font-display text-xl mt-1">{timeline.availability.length}</p></div><div className="border border-border rounded-lg p-3 bg-surface"><p className="text-xs text-ink-soft">Available to plan</p><p className="font-display text-xl mt-1">{hours(Math.max(0, timeline.weeklyCapacityMinutes - Math.round(plannedMinutes)))}</p></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
              {days.map((day) => {
                const date = dayKey(day);
                const dayBlocks = timeline.blocks.filter((block) => dayKey(new Date(block.startsAt)) === date);
                const dayAvailability = timeline.availability.filter((item) => dayKey(new Date(item.startsAt)) === date);
                return <section key={date} className="border border-border rounded-lg bg-surface min-h-52 flex flex-col"><div className="flex items-center justify-between px-3 py-2.5 border-b border-border"><span className="text-sm font-medium">{shortDay(day)}</span><button onClick={() => openNewBlock(day)} className="text-sm text-accent hover:underline">+</button></div><div className="p-2 space-y-2 flex-1">{dayAvailability.map((item) => <div key={item.id} className="border border-[#C98A2B]/40 bg-[#C98A2B]/10 rounded p-2 text-xs"><span className="font-medium">Unavailable</span><br />{timeLabel(item.startsAt)}–{timeLabel(item.endsAt)}{item.reason && <span className="block text-ink-soft mt-0.5">{item.reason}</span>}</div>)}{dayBlocks.map((block) => <button key={block.id} onClick={() => openEditBlock(block)} className={`w-full text-left border rounded p-2 transition-colors hover:border-accent ${KIND_STYLES[block.kind]}`}><div className="text-[11px] text-ink-soft">{timeLabel(block.startsAt)}–{timeLabel(block.endsAt)} · {KIND_LABELS[block.kind]}</div><div className="text-sm font-medium mt-0.5 break-words">{block.title}</div>{block.project && <div className="text-[11px] text-ink-soft mt-1 truncate">{block.project.name}</div>}</button>)}{dayBlocks.length === 0 && dayAvailability.length === 0 && <p className="text-xs text-ink-soft px-1 py-2">Nothing planned.</p>}</div></section>;
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
