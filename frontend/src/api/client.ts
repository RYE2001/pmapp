const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export type Role = "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type TimeBlockKind = "WORK" | "MEETING" | "SUPPORT" | "OTHER";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface BlockerComment {
  id: string;
  message: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface Blocker {
  id: string;
  reason: string;
  isExternal: boolean;
  resolved: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
  comments: BlockerComment[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  role: Role;
  taskCount: number;
  memberCount: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  members: { id: string; role: Role; user: User }[];
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  estimatedMinutes: number;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  assignee: User | null;
  _count?: { timeEntries: number };
  activeBlocker?: { id: string; reason: string; isExternal: boolean; createdAt: string } | null;
}

export interface MyTask extends Task {
  project: { id: string; name: string };
}

export interface TimeEntry {
  id: string;
  minutes: number;
  note: string | null;
  loggedAt: string;
  user: { id: string; name: string };
}

export interface TaskComment {
  id: string;
  message: string;
  createdAt: string;
  author: { id: string; name: string };
  mentions: { user: User }[];
}

export interface TaskActivity {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  actor: { id: string; name: string };
}

export interface ProjectEvent {
  type: string;
  taskId?: string;
}

export interface TimelineProject {
  id: string;
  name: string;
  tasks: { id: string; title: string }[];
}

export interface TimeBlock {
  id: string;
  title: string;
  kind: TimeBlockKind;
  startsAt: string;
  endsAt: string;
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  assignmentId?: string | null;
}

export interface Availability {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface TimelineData {
  weekStart: string;
  weekEnd: string;
  weeklyCapacityMinutes: number;
  blocks: TimeBlock[];
  availability: Availability[];
  projects: TimelineProject[];
}

export type WorkAllocationType = "TASK" | "MEETING" | "SUPPORT" | "ADMIN" | "TRAINING" | "UNPLANNED" | "UNAVAILABLE";
export type WorkAllocationSource = "MANUAL" | "TASK_ASSIGNMENT" | "CALENDAR" | "TIME_ENTRY" | "SYSTEM";
export type WorkAllocationStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface WorkAllocation {
  id: string;
  type: WorkAllocationType;
  source: WorkAllocationSource;
  status: WorkAllocationStatus;
  startsAt: string;
  endsAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  title: string;
  project: { id: string; name: string } | null;
  task: { id: string; title: string; status: TaskStatus } | null;
}

export interface WorkAllocationData {
  weekStart: string;
  weekEnd: string;
  allocations: WorkAllocation[];
}

export interface TaskAssignment {
  id: string;
  plannedMinutes: number;
  scheduledFor: string;
  user: User;
  timeBlock: TimeBlock | null;
}

export interface CapacityPerson extends User {
  capacityMinutes: number;
  unavailableMinutes: number;
  plannedMinutes: number;
  actualMinutes: number;
  workloadPercent: number;
  isOverloaded: boolean;
  projectCount: number;
  contextSwitching: boolean;
  projectAllocations: { projectId: string; name: string; minutes: number }[];
}

export interface TeamCapacity {
  weekStart: string;
  weekEnd: string;
  people: CapacityPerson[];
  plannedVsActual: { id: string; title: string; plannedMinutes: number; actualMinutes: number }[];
}

export interface DeadlineScenario {
  project: { id: string; name: string; priority: number };
  newDeadline: string;
  horizonWeeks: number;
  currentWorkloadMinutes: number;
  availableCapacityMinutes: number;
  deficitMinutes: number;
  options: {
    movePeople: {
      type: "MOVE_PERSON";
      person: User;
      availableMinutes: number;
      projectRiskPercent: number;
      projectsAffected: number;
      explanation: string;
    }[];
    externalResource: { additionalMinutes: number; explanation: string };
    reduceScope: {
      savedMinutes: number;
      fullyCovered: boolean;
      tasks: { id: string; title: string; estimatedMinutes: number }[];
    };
  };
}

export type DecisionStatus = "ACTIVE" | "SUPERSEDED" | "REVERSED";

export interface Decision {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  alternatives: string | null;
  status: DecisionStatus;
  decidedAt: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  people: { user: User }[];
  evidence: { id: string; label: string; url: string | null }[];
  taskLinks: { task: { id: string; title: string; status: TaskStatus } }[];
}

export interface Report {
  tasksByStatus: Partial<Record<TaskStatus, number>>;
  minutesLoggedByUser: { userId: string; name: string; minutes: number }[];
  overdueTasks: { id: string; title: string; dueDate: string | null }[];
  externalBlockers: { taskId: string; title: string; reason: string }[];
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("pm_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error || "Something went wrong", res.status);
  }
  return body as T;
}

// EventSource cannot send an Authorization header. Using fetch keeps the JWT out of URLs while
// still allowing a lightweight, dependency-free server-sent event stream.
function subscribeToProject(projectId: string, onEvent: (event: ProjectEvent) => void) {
  let cancelled = false;
  let controller: AbortController | undefined;
  let reconnectTimer: number | undefined;

  async function connect() {
    controller = new AbortController();
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/api/events/project/${projectId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("Could not open live updates");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";
        for (const message of messages) {
          if (!message.startsWith("event: project")) continue;
          const data = message.split("\n").find((line) => line.startsWith("data: "));
          if (!data) continue;
          try {
            onEvent(JSON.parse(data.slice("data: ".length)) as ProjectEvent);
          } catch {
            // Ignore a malformed event; the next event or normal reload will repair the view.
          }
        }
      }
      reader.releaseLock();
    } catch {
      // The stream automatically reconnects after transient server or network interruptions.
    }

    if (!cancelled) reconnectTimer = window.setTimeout(connect, 3000);
  }

  void connect();
  return () => {
    cancelled = true;
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    controller?.abort();
  };
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  listProjects: () => request<ProjectSummary[]>("/api/projects"),

  createProject: (name: string, description?: string) =>
    request<{ id: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),

  getProject: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),

  addMember: (projectId: string, email: string, role: Role = "MEMBER") =>
    request(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),

  listTasks: (projectId: string) => request<Task[]>(`/api/tasks/project/${projectId}`),

  myTasks: () => request<MyTask[]>("/api/tasks/mine"),

  createTask: (projectId: string, data: Partial<Task>) =>
    request<Task>(`/api/tasks/project/${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTask: (taskId: string, data: Partial<Task>) =>
    request<Task>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTask: (taskId: string) =>
    request<void>(`/api/tasks/${taskId}`, { method: "DELETE" }),

  listTaskComments: (taskId: string) => request<TaskComment[]>(`/api/tasks/${taskId}/comments`),

  addTaskComment: (taskId: string, message: string, mentionedUserIds: string[]) =>
    request<{ comment: TaskComment; activity: TaskActivity }>(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ message, mentionedUserIds }),
    }),

  listTaskActivity: (taskId: string) => request<TaskActivity[]>(`/api/tasks/${taskId}/activity`),

  subscribeToProject,

  getMyTimeline: (start: string) => request<TimelineData>(`/api/resources/me/timeline?start=${encodeURIComponent(start)}`),

  getMyAllocations: (start: string) => request<WorkAllocationData>(`/api/resources/me/allocations?start=${encodeURIComponent(start)}`),

  setWeeklyCapacity: (weeklyCapacityMinutes: number) =>
    request<{ weeklyCapacityMinutes: number }>("/api/resources/me/capacity", {
      method: "PUT",
      body: JSON.stringify({ weeklyCapacityMinutes }),
    }),

  createAvailability: (data: { startsAt: string; endsAt: string; reason?: string }) =>
    request<Availability>("/api/resources/availability", { method: "POST", body: JSON.stringify(data) }),

  deleteAvailability: (availabilityId: string) =>
    request<void>(`/api/resources/availability/${availabilityId}`, { method: "DELETE" }),

  createTimeBlock: (data: {
    title: string; kind: TimeBlockKind; startsAt: string; endsAt: string; projectId?: string | null; taskId?: string | null;
  }) => request<TimeBlock>("/api/resources/time-blocks", { method: "POST", body: JSON.stringify(data) }),

  updateTimeBlock: (blockId: string, data: Partial<{
    title: string; kind: TimeBlockKind; startsAt: string; endsAt: string; projectId: string | null; taskId: string | null;
  }>) => request<TimeBlock>(`/api/resources/time-blocks/${blockId}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteTimeBlock: (blockId: string) =>
    request<void>(`/api/resources/time-blocks/${blockId}`, { method: "DELETE" }),

  listTaskAssignments: (taskId: string) => request<TaskAssignment[]>(`/api/resources/tasks/${taskId}/assignments`),

  createTaskAssignment: (taskId: string, data: { userId: string; startsAt: string; endsAt: string }) =>
    request<TaskAssignment>(`/api/resources/tasks/${taskId}/assignments`, { method: "POST", body: JSON.stringify(data) }),

  deleteTaskAssignment: (assignmentId: string) =>
    request<void>(`/api/resources/assignments/${assignmentId}`, { method: "DELETE" }),

  getTeamCapacity: (start: string) => request<TeamCapacity>(`/api/resources/team-capacity?start=${encodeURIComponent(start)}`),

  runDeadlineScenario: (projectId: string, newDeadline: string) =>
    request<DeadlineScenario>(`/api/scenarios/projects/${projectId}/deadline`, {
      method: "POST",
      body: JSON.stringify({ newDeadline }),
    }),

  listTimeEntries: (taskId: string) => request<TimeEntry[]>(`/api/time-entries/task/${taskId}`),

  logTime: (taskId: string, minutes: number, note?: string) =>
    request<TimeEntry>(`/api/time-entries/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ minutes, note }),
    }),

  getReport: (projectId: string) => request<Report>(`/api/reports/project/${projectId}`),

  listDecisions: (projectId: string) => request<Decision[]>(`/api/decisions/project/${projectId}`),

  createDecision: (projectId: string, data: {
    title: string;
    summary: string;
    rationale: string;
    alternatives?: string;
    decidedAt?: string;
    peopleIds: string[];
    taskIds: string[];
    evidence: { label: string; url?: string }[];
  }) => request<Decision>(`/api/decisions/project/${projectId}`, {
    method: "POST",
    body: JSON.stringify(data),
  }),

  updateDecisionStatus: (decisionId: string, status: DecisionStatus) =>
    request<Decision>(`/api/decisions/${decisionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getBlocker: (taskId: string) => request<{ blocker: Blocker | null }>(`/api/blockers/task/${taskId}`),

  reportBlocker: (taskId: string, reason: string) =>
    request<{ blocker: Blocker }>(`/api/blockers/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  addBlockerComment: (blockerId: string, message: string) =>
    request<BlockerComment>(`/api/blockers/${blockerId}/comments`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  updateBlocker: (blockerId: string, data: { isExternal?: boolean; resolved?: boolean }) =>
    request<{ blocker: Blocker }>(`/api/blockers/${blockerId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

export { ApiError, getToken };
