import type { TaskCounts, TaskFilter } from "../utils/taskLogic";

interface FilterTabsProps {
  activeFilter: TaskFilter;
  onChangeFilter: (filter: TaskFilter) => void;
  counts: TaskCounts;
}

const FILTER_OPTIONS: { id: TaskFilter; label: string; countKey: keyof TaskCounts }[] = [
  { id: "All", label: "All", countKey: "all" },
  { id: "Pending", label: "Pending", countKey: "pending" },
  { id: "Completed", label: "Completed", countKey: "completed" },
];

export function FilterTabs({
  activeFilter,
  onChangeFilter,
  counts,
}: FilterTabsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
      <div
        role="tablist"
        aria-label="Filter tasks by status"
        className="flex w-full items-center gap-6 sm:w-auto"
      >
        {FILTER_OPTIONS.map((option) => {
          const isActive = activeFilter === option.id;
          const count = counts[option.countKey];
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChangeFilter(option.id)}
              className={`relative inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                isActive
                  ? "border-white font-semibold text-white"
                  : "border-transparent font-medium text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{option.label}</span>
              <span
                className={`font-mono text-xs tabular-nums ${
                  isActive ? "text-slate-300" : "text-slate-500"
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      <p className="pb-2 font-mono text-xs text-slate-400 tabular-nums">
        {counts.completed} of {counts.all} completed
      </p>
    </div>
  );
}
