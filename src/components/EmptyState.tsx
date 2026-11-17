import { CheckCircle2, ClipboardList, Plus } from "lucide-react";
import type { TaskFilter } from "../utils/taskLogic";

interface EmptyStateProps {
  activeFilter: TaskFilter;
  totalCount: number;
  onResetFilter: () => void;
  onFocusInput: () => void;
}

export function EmptyState({
  activeFilter,
  totalCount,
  onResetFilter,
  onFocusInput,
}: EmptyStateProps) {
  const isFilteredEmpty = totalCount > 0 && activeFilter !== "All";

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-[#111622] px-6 py-14 text-center">
      <div
        className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-800 bg-[#0b0f17] text-slate-300"
        aria-hidden="true"
      >
        {isFilteredEmpty ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <ClipboardList className="h-5 w-5" />
        )}
      </div>

      <h2 className="font-display text-lg font-semibold text-white">
        {isFilteredEmpty
          ? `No ${activeFilter.toLowerCase()} tasks`
          : "No tasks synced yet"}
      </h2>

      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-400">
        {isFilteredEmpty
          ? `You don't have any tasks in the "${activeFilter}" view right now.`
          : "Add your first task above to start organizing your list."}
      </p>

      <div className="mt-6">
        {isFilteredEmpty ? (
          <button
            type="button"
            onClick={onResetFilter}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-[#0b0f17] px-4 text-sm font-medium text-slate-200 transition-colors duration-150 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Show All Tasks
          </button>
        ) : (
          <button
            type="button"
            onClick={onFocusInput}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md bg-slate-100 px-4 text-sm font-medium text-slate-950 transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111622]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create First Task
          </button>
        )}
      </div>
    </div>
  );
}
