/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Header } from "./components/Header";
import { TaskInputBar } from "./components/TaskInputBar";
import { FilterTabs } from "./components/FilterTabs";
import { TaskCard } from "./components/TaskCard";
import { EmptyState } from "./components/EmptyState";
import {
  computeTaskCounts,
  filterTasks,
  type Priority,
  type TaskFilter,
  type TaskItem,
} from "./utils/taskLogic";
import {
  createTask,
  deleteTask,
  subscribeToTasks,
  toggleTaskCompleted,
} from "./services/taskService";

export default function App() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToTasks({
      onTasks: (nextTasks) => {
        setTasks(nextTasks);
        setIsLoading(false);
        setErrorMessage(null);
      },
      onError: (message) => {
        setIsLoading(false);
        setErrorMessage(message);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const counts = useMemo(() => computeTaskCounts(tasks), [tasks]);
  const visibleTasks = useMemo(
    () => filterTasks(tasks, activeFilter),
    [tasks, activeFilter]
  );

  const handleAddTask = async (title: string, priority: Priority) => {
    setErrorMessage(null);
    try {
      await createTask(title, priority);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unable to save task.";
      setErrorMessage(msg);
      throw error;
    }
  };

  const handleToggleTask = async (taskId: string, nextCompleted: boolean) => {
    setErrorMessage(null);
    const previousTasks = tasks;
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, completed: nextCompleted } : task
      )
    );
    try {
      await toggleTaskCompleted(taskId, nextCompleted);
    } catch (error) {
      setTasks(previousTasks);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update task."
      );
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setErrorMessage(null);
    const previousTasks = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch (error) {
      setTasks(previousTasks);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete task."
      );
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b0f17] text-slate-100">
      <div className="flex min-h-screen flex-col">
        <Header />

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-red-400"
                  aria-hidden="true"
                />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss error message"
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-red-200 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <TaskInputBar onAddTask={handleAddTask} inputRef={inputRef} />

          <section aria-label="Task queue" className="flex flex-col gap-4">
            <FilterTabs
              activeFilter={activeFilter}
              onChangeFilter={setActiveFilter}
              counts={counts}
            />

            {isLoading ? (
              <div
                aria-label="Loading tasks"
                className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800 bg-[#111622]"
              >
                {[1, 2, 3].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="h-14 animate-pulse bg-[#111622] px-5 py-4"
                  />
                ))}
              </div>
            ) : visibleTasks.length === 0 ? (
              <EmptyState
                activeFilter={activeFilter}
                totalCount={counts.all}
                onResetFilter={() => setActiveFilter("All")}
                onFocusInput={() => inputRef.current?.focus()}
              />
            ) : (
              <div
                data-testid="task-list"
                className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800 bg-[#111622]"
              >
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
