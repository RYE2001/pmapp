const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export type Role = "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

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

  listTimeEntries: (taskId: string) => request<TimeEntry[]>(`/api/time-entries/task/${taskId}`),

  logTime: (taskId: string, minutes: number, note?: string) =>
    request<TimeEntry>(`/api/time-entries/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ minutes, note }),
    }),

  getReport: (projectId: string) => request<Report>(`/api/reports/project/${projectId}`),

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
