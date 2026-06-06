export interface Task {
  id: string;
  title: string;
  priority: "must" | "nice";
  estimatedDurationMinutes: number;
  deadlineDate: string | null;
  deadlineTime: string | null;
  ambiguous: boolean;
  status: "inbox" | "today" | "completed" | "deleted";
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  source?: "mail";
  sourceEmailId?: string;
  sourceEmailSubject?: string;
}

const STORAGE_KEY = "ai_planner_tasks";

function now(): string {
  return new Date().toISOString();
}

export function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function addTasks(newTasks: Omit<Task, "id" | "createdAt" | "updatedAt">[]): Task[] {
  const tasks = loadTasks();
  const created: Task[] = newTasks.map((t) => ({
    ...t,
    id: crypto.randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  }));
  const updated = [...tasks, ...created];
  saveTasks(updated);
  return created;
}

export function updateTask(id: string, patch: Partial<Task>): Task | null {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...patch, updatedAt: now() };
  saveTasks(tasks);
  return tasks[idx];
}

export function getTodayTasks(): Task[] {
  return loadTasks().filter((t) => t.status === "today" || t.status === "completed");
}

export function getInboxTasks(): Task[] {
  return loadTasks().filter((t) => t.status === "inbox");
}

export function getInboxCount(): number {
  return loadTasks().filter((t) => t.status === "inbox").length;
}

export function completeTask(id: string, completed: boolean): Task | null {
  return updateTask(id, {
    status: completed ? "completed" : "today",
    completedAt: completed ? now() : null,
  });
}

export function addToToday(id: string): Task | null {
  return updateTask(id, { status: "today" });
}

export function deleteTask(id: string): Task | null {
  return updateTask(id, { status: "deleted" });
}

export function restoreTask(id: string, previousStatus: Task["status"]): Task | null {
  return updateTask(id, { status: previousStatus });
}
