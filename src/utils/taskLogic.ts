export type Priority = "Normal" | "Medium" | "High";

export type TaskFilter = "All" | "Pending" | "Completed";

export interface TaskItem {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  createdAtMs: number;
}

export interface TaskCounts {
  all: number;
  pending: number;
  completed: number;
}

export interface TitleValidationResult {
  valid: boolean;
  value: string;
  error?: string;
}

const MAX_TITLE_LENGTH = 240;

export function normalizePriority(raw: unknown): Priority {
  if (typeof raw !== "string") {
    return "Normal";
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Normal";
}

export function validateTaskTitle(raw: string): TitleValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      value: "",
      error: "Please enter a task title before adding.",
    };
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      value: trimmed,
      error: `Task title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
    };
  }
  return {
    valid: true,
    value: trimmed,
  };
}

export function parseCreatedAtMs(raw: unknown, fallbackMs = 0): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (raw instanceof Date && Number.isFinite(raw.getTime())) {
    return raw.getTime();
  }
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (raw && typeof raw === "object") {
    const record = raw as {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof record.toMillis === "function") {
      const ms = record.toMillis();
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof record.seconds === "number" && Number.isFinite(record.seconds)) {
      const nanos =
        typeof record.nanoseconds === "number" && Number.isFinite(record.nanoseconds)
          ? record.nanoseconds / 1_000_000
          : 0;
      return record.seconds * 1000 + nanos;
    }
  }
  return fallbackMs;
}

export function sortTasksByCreatedAtDesc(tasks: readonly TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    if (b.createdAtMs !== a.createdAtMs) {
      return b.createdAtMs - a.createdAtMs;
    }
    return a.id.localeCompare(b.id);
  });
}

export function filterTasks(tasks: readonly TaskItem[], filter: TaskFilter): TaskItem[] {
  if (filter === "Pending") {
    return tasks.filter((task) => !task.completed);
  }
  if (filter === "Completed") {
    return tasks.filter((task) => task.completed);
  }
  return [...tasks];
}

export function computeTaskCounts(tasks: readonly TaskItem[]): TaskCounts {
  let completed = 0;
  for (const task of tasks) {
    if (task.completed) completed += 1;
  }
  const all = tasks.length;
  return {
    all,
    pending: all - completed,
    completed,
  };
}

export function formatTaskTimestamp(createdAtMs: number, nowMs = Date.now()): string {
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) {
    return "Synced";
  }
  const diffMs = Math.max(0, nowMs - createdAtMs);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(createdAtMs));
}
