import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTaskCounts,
  filterTasks,
  formatTaskTimestamp,
  normalizePriority,
  parseCreatedAtMs,
  sortTasksByCreatedAtDesc,
  validateTaskTitle,
  type TaskItem,
} from "./taskLogic";

test("normalizePriority normalizes case and defaults unknown values to Normal", () => {
  assert.equal(normalizePriority("High"), "High");
  assert.equal(normalizePriority("high"), "High");
  assert.equal(normalizePriority(" MEDIUM "), "Medium");
  assert.equal(normalizePriority("normal"), "Normal");
  assert.equal(normalizePriority("urgent"), "Normal");
  assert.equal(normalizePriority(undefined), "Normal");
});

test("validateTaskTitle rejects empty or oversized input and trims valid titles", () => {
  assert.deepEqual(validateTaskTitle("   "), {
    valid: false,
    value: "",
    error: "Please enter a task title before adding.",
  });

  const valid = validateTaskTitle("  Deploy MCP Firestore rules  ");
  assert.equal(valid.valid, true);
  assert.equal(valid.value, "Deploy MCP Firestore rules");

  const tooLong = validateTaskTitle("a".repeat(241));
  assert.equal(tooLong.valid, false);
});

test("parseCreatedAtMs supports Firestore timestamps, numbers, Dates, and ISO strings", () => {
  assert.equal(parseCreatedAtMs(1700000000000), 1700000000000);
  assert.equal(parseCreatedAtMs({ toMillis: () => 1700000005000 }), 1700000005000);
  assert.equal(parseCreatedAtMs({ seconds: 1700000000, nanoseconds: 500_000_000 }), 1700000000500);
  assert.equal(parseCreatedAtMs("2026-11-16T08:00:00.000Z"), Date.parse("2026-11-16T08:00:00.000Z"));
  assert.equal(parseCreatedAtMs(null, 42), 42);
});

test("sortTasksByCreatedAtDesc sorts newest first without mutating input", () => {
  const input: TaskItem[] = [
    { id: "1", title: "Older", priority: "Normal", completed: false, createdAtMs: 100 },
    { id: "2", title: "Newest", priority: "High", completed: false, createdAtMs: 300 },
    { id: "3", title: "Middle", priority: "Medium", completed: true, createdAtMs: 200 },
  ];
  const sorted = sortTasksByCreatedAtDesc(input);
  assert.deepEqual(
    sorted.map((t) => t.id),
    ["2", "3", "1"]
  );
  assert.equal(input[0].id, "1");
});

test("filterTasks and computeTaskCounts accurately partition tasks", () => {
  const tasks: TaskItem[] = [
    { id: "a", title: "One", priority: "High", completed: false, createdAtMs: 3 },
    { id: "b", title: "Two", priority: "Medium", completed: true, createdAtMs: 2 },
    { id: "c", title: "Three", priority: "Normal", completed: false, createdAtMs: 1 },
  ];

  assert.deepEqual(computeTaskCounts(tasks), {
    all: 3,
    pending: 2,
    completed: 1,
  });

  assert.deepEqual(
    filterTasks(tasks, "All").map((t) => t.id),
    ["a", "b", "c"]
  );
  assert.deepEqual(
    filterTasks(tasks, "Pending").map((t) => t.id),
    ["a", "c"]
  );
  assert.deepEqual(
    filterTasks(tasks, "Completed").map((t) => t.id),
    ["b"]
  );
});

test("formatTaskTimestamp renders human-readable relative times", () => {
  const now = 1_700_000_000_000;
  assert.equal(formatTaskTimestamp(now - 20_000, now), "Just now");
  assert.equal(formatTaskTimestamp(now - 15 * 60_000, now), "15m ago");
  assert.equal(formatTaskTimestamp(now - 3 * 3_600_000, now), "3h ago");
  assert.equal(formatTaskTimestamp(0, now), "Synced");
});
