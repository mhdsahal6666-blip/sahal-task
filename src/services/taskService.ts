import {
  normalizePriority,
  parseCreatedAtMs,
  sortTasksByCreatedAtDesc,
  type Priority,
  type TaskItem,
} from "../utils/taskLogic";

export interface SubscriptionCallbacks {
  onTasks: (tasks: TaskItem[]) => void;
  onError?: (message: string) => void;
}

function normalizeTaskList(raw: unknown): TaskItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return sortTasksByCreatedAtDesc(
    raw.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? ""),
        title:
          typeof record.title === "string" && record.title.trim()
            ? record.title
            : "Untitled Task",
        priority: normalizePriority(record.priority),
        completed: Boolean(record.completed),
        createdAtMs: parseCreatedAtMs(record.createdAtMs, Date.now()),
      };
    })
  );
}

async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Ignore non-JSON error body
  }
  return fallback;
}

export function subscribeToTasks(callbacks: SubscriptionCallbacks): () => void {
  let closed = false;
  let receivedStreamPayload = false;

  const eventSource = new EventSource("/api/tasks/stream");

  eventSource.addEventListener("tasks", (event) => {
    if (closed) return;
    receivedStreamPayload = true;
    try {
      const parsed = JSON.parse((event as MessageEvent<string>).data);
      callbacks.onTasks(normalizeTaskList(parsed));
    } catch {
      callbacks.onError?.("Received malformed task payload from server.");
    }
  });

  eventSource.addEventListener("sync_error", (event) => {
    if (closed) return;
    try {
      const parsed = JSON.parse((event as MessageEvent<string>).data) as {
        message?: string;
      };
      callbacks.onError?.(
        parsed.message ?? "Unable to synchronize tasks with server."
      );
    } catch {
      callbacks.onError?.("Unable to synchronize tasks with server.");
    }
  });

  fetch("/api/tasks")
    .then(async (res) => {
      if (closed) return;
      if (!res.ok) {
        const message = await parseErrorResponse(
          res,
          "Failed to load tasks from server."
        );
        callbacks.onError?.(message);
        return;
      }
      if (!receivedStreamPayload) {
        const body = (await res.json()) as { tasks?: unknown };
        callbacks.onTasks(normalizeTaskList(body.tasks));
      }
    })
    .catch(() => {
      if (!closed && !receivedStreamPayload) {
        callbacks.onError?.("Unable to reach task sync server.");
      }
    });

  return () => {
    closed = true;
    eventSource.close();
  };
}

export async function createTask(title: string, priority: Priority): Promise<void> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, priority }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, "Failed to add task."));
  }
}

export async function toggleTaskCompleted(
  taskId: string,
  nextCompleted: boolean
): Promise<void> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: nextCompleted }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, "Failed to update task."));
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, "Failed to delete task."));
  }
}
