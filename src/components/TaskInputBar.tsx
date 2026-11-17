import { useState, type FormEvent, type RefObject } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { validateTaskTitle, type Priority } from "../utils/taskLogic";

interface TaskInputBarProps {
  onAddTask: (title: string, priority: Priority) => Promise<void>;
  inputRef: RefObject<HTMLInputElement | null>;
}

const PRIORITIES: Priority[] = ["Normal", "Medium", "High"];

export function TaskInputBar({ onAddTask, inputRef }: TaskInputBarProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateTaskTitle(title);
    if (!validation.valid) {
      setValidationError(validation.error ?? "Task title is required.");
      inputRef.current?.focus();
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);
    try {
      await onAddTask(validation.value, priority);
      setTitle("");
      setPriority("Normal");
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : "Failed to add task."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-label="Create new task" className="w-full">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-lg border border-slate-800 bg-[#111622] p-3 transition-colors duration-150 focus-within:border-slate-600 sm:p-4"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="task-title-input" className="sr-only">
              Task title
            </label>
            <input
              ref={inputRef}
              id="task-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Write a new task..."
              disabled={isSubmitting}
              aria-invalid={validationError ? "true" : "false"}
              aria-describedby={validationError ? "task-input-error" : undefined}
              className="h-10 w-full rounded-md border border-slate-800 bg-[#0b0f17] px-3.5 text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-150 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/25 disabled:opacity-60"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-32 sm:flex-none">
              <label htmlFor="task-priority-select" className="sr-only">
                Task priority
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={isSubmitting}
                className="h-10 w-full appearance-none rounded-md border border-slate-800 bg-[#0b0f17] pl-3 pr-8 text-sm font-medium text-slate-200 transition-colors duration-150 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/25 disabled:opacity-60"
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item} className="bg-[#111622] text-slate-100">
                    {item}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-slate-100 px-4 text-sm font-medium text-slate-950 transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111622] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{isSubmitting ? "Adding..." : "Add Task"}</span>
            </button>
          </div>
        </div>

        {validationError && (
          <p
            id="task-input-error"
            role="alert"
            className="mt-2 text-xs font-medium text-red-400"
          >
            {validationError}
          </p>
        )}
      </form>
    </section>
  );
}
