import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import {
  formatTaskTimestamp,
  type Priority,
  type TaskItem,
} from "../utils/taskLogic";

interface TaskCardProps {
  task: TaskItem;
  onToggle: (taskId: string, nextCompleted: boolean) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  High: "border-red-500/30 bg-red-500/15 text-red-300",
  Medium: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  Normal: "border-sky-500/30 bg-sky-500/15 text-sky-300",
};

export function TaskCard({ task, onToggle, onDelete }: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await onToggle(task.id, !task.completed);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await onDelete(task.id);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <article
      className={`group flex items-start justify-between gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-[#161c2b] sm:items-center sm:px-5 ${
        task.completed ? "bg-[#0f141e]" : "bg-[#111622]"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center pt-0.5 sm:pt-0">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleToggle}
            disabled={isUpdating}
            aria-label={`Mark "${task.title}" as ${
              task.completed ? "pending" : "completed"
            }`}
            className="peer absolute -inset-2 z-10 h-10 w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span
            aria-hidden="true"
            className={`flex h-4.5 w-4.5 items-center justify-center rounded border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-white peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#111622] ${
              task.completed
                ? "border-white bg-white text-slate-950"
                : "border-slate-600 bg-[#0b0f17] text-transparent peer-hover:border-slate-400"
            }`}
          >
            <Check className="h-3 w-3 stroke-[2.5]" />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2
            className={`break-words text-sm font-medium leading-snug transition-colors duration-150 ${
              task.completed
                ? "text-slate-500 line-through decoration-slate-500"
                : "text-slate-100"
            }`}
          >
            {task.title}
          </h2>

          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
                PRIORITY_STYLES[task.priority]
              }`}
            >
              {task.priority}
            </span>

            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {formatTaskTimestamp(task.createdAtMs)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isUpdating}
        aria-label={`Delete "${task.title}"`}
        className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </article>
  );
}
