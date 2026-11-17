import "dotenv/config";
import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  initializeFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import {
  normalizePriority,
  parseCreatedAtMs,
  sortTasksByCreatedAtDesc,
  validateTaskTitle,
  type TaskItem,
} from "./src/utils/taskLogic.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const TASKS_COLLECTION = "tasks";
const WRITE_TIMEOUT_MS = 5000;

function readServerFirebaseConfig() {
  const apiKey = process.env.FIREBASE_API_KEY?.trim() ?? "";
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN?.trim() ?? "";
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim() ?? "";
  const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "";
  const appId = process.env.FIREBASE_APP_ID?.trim() ?? "";

  const isPlaceholder = (v: string) =>
    !v || v.startsWith("YOUR_") || v.startsWith("MY_");

  if (isPlaceholder(apiKey) || isPlaceholder(projectId) || isPlaceholder(appId)) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

let db: Firestore | null = null;
const serverFirebaseConfig = readServerFirebaseConfig();

if (serverFirebaseConfig) {
  try {
    const firebaseApp =
      getApps().length > 0 ? getApps()[0] : initializeApp(serverFirebaseConfig);
    db = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
  } catch (error) {
    console.error("Server Firebase initialization failed:", error);
    db = null;
  }
}

function mapDoc(id: string, data: DocumentData): TaskItem {
  return {
    id,
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : "Untitled Task",
    priority: normalizePriority(data.priority),
    completed: Boolean(data.completed),
    createdAtMs: parseCreatedAtMs(data.created_at, Date.now()),
  };
}

function isValidTaskId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= 128 && !id.includes("/");
}

function formatFirestoreError(error: unknown, fallbackMessage: string): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  if (
    code === "permission-denied" ||
    message.includes("PERMISSION_DENIED") ||
    message.includes("has not been used in project") ||
    message.includes("is disabled")
  ) {
    return "Cloud Firestore API is disabled or permission was denied. Enable Firestore Database in Firebase Console and check your Security Rules.";
  }
  if (
    code === "not-found" ||
    code === "unavailable" ||
    message.includes("NOT_FOUND") ||
    message.includes("FIRESTORE_TIMEOUT")
  ) {
    return "Cloud Firestore database is not enabled yet for this Firebase project. Create the (default) Firestore database in Firebase Console.";
  }
  return fallbackMessage;
}

async function withTimeout<T>(promise: Promise<T>, ms = WRITE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("FIRESTORE_TIMEOUT")), ms)
    ),
  ]);
}

const sseClients = new Set<Response>();
let cachedTasks: TaskItem[] | null = null;
let firestoreUnsubscribe: (() => void) | null = null;

function broadcastTasks(tasks: TaskItem[]) {
  cachedTasks = tasks;
  const payload = `event: tasks\ndata: ${JSON.stringify(tasks)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function broadcastError(message: string) {
  const payload = `event: sync_error\ndata: ${JSON.stringify({ message })}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function ensureFirestoreListener() {
  if (!db || firestoreUnsubscribe) return;
  try {
    const tasksQuery = query(
      collection(db, TASKS_COLLECTION),
      orderBy("created_at", "desc")
    );
    firestoreUnsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        if (snapshot.metadata.fromCache && snapshot.empty) {
          return;
        }
        const items = sortTasksByCreatedAtDesc(
          snapshot.docs.map((snapDoc) => mapDoc(snapDoc.id, snapDoc.data()))
        );
        broadcastTasks(items);
      },
      (error) => {
        console.error("Server Firestore listener error:", error);
        broadcastError(
          formatFirestoreError(error, "Unable to sync tasks with Firestore.")
        );
        firestoreUnsubscribe?.();
        firestoreUnsubscribe = null;
      }
    );
  } catch (error) {
    console.error("Failed to attach Firestore listener:", error);
    firestoreUnsubscribe = null;
  }
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      connected: Boolean(db),
    });
  });

  app.get("/api/tasks", async (_req, res) => {
    if (!db) {
      res.status(503).json({
        error: "Database is not configured on the server.",
      });
      return;
    }

    try {
      const tasksQuery = query(
        collection(db, TASKS_COLLECTION),
        orderBy("created_at", "desc")
      );
      const snapshot = await withTimeout(getDocsFromServer(tasksQuery));
      const tasks = sortTasksByCreatedAtDesc(
        snapshot.docs.map((snapDoc) => mapDoc(snapDoc.id, snapDoc.data()))
      );
      cachedTasks = tasks;
      res.json({ tasks });
    } catch (error) {
      console.error("GET /api/tasks error:", error);
      res.status(503).json({
        error: formatFirestoreError(error, "Failed to load tasks from Firestore."),
      });
    }
  });

  app.get("/api/tasks/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    if (!db) {
      res.write(
        `event: sync_error\ndata: ${JSON.stringify({
          message: "Database is not configured on the server.",
        })}\n\n`
      );
      res.end();
      return;
    }

    sseClients.add(res);
    ensureFirestoreListener();

    if (cachedTasks !== null) {
      res.write(`event: tasks\ndata: ${JSON.stringify(cachedTasks)}\n\n`);
    }

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
      if (sseClients.size === 0 && firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
        cachedTasks = null;
      }
    });
  });

  app.post("/api/tasks", async (req, res) => {
    if (!db) {
      res.status(503).json({ error: "Database is not configured on the server." });
      return;
    }

    const rawTitle = typeof req.body?.title === "string" ? req.body.title : "";
    const validation = validateTaskTitle(rawTitle);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error ?? "Invalid task title." });
      return;
    }

    const priority = normalizePriority(req.body?.priority);

    try {
      const created = await withTimeout(
        addDoc(collection(db, TASKS_COLLECTION), {
          title: validation.value,
          priority,
          completed: false,
          created_at: serverTimestamp(),
        })
      );
      res.status(201).json({ id: created.id });
    } catch (error) {
      console.error("POST /api/tasks error:", error);
      res.status(503).json({
        error: formatFirestoreError(error, "Failed to create task in Firestore."),
      });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    if (!db) {
      res.status(503).json({ error: "Database is not configured on the server." });
      return;
    }

    const taskId = req.params.id;
    if (!isValidTaskId(taskId)) {
      res.status(400).json({ error: "Invalid task id." });
      return;
    }

    if (typeof req.body?.completed !== "boolean") {
      res.status(400).json({ error: "Field 'completed' must be a boolean." });
      return;
    }

    try {
      await withTimeout(
        updateDoc(doc(db, TASKS_COLLECTION, taskId), {
          completed: req.body.completed,
        })
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("PATCH /api/tasks error:", error);
      res.status(503).json({
        error: formatFirestoreError(error, "Failed to update task in Firestore."),
      });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    if (!db) {
      res.status(503).json({ error: "Database is not configured on the server." });
      return;
    }

    const taskId = req.params.id;
    if (!isValidTaskId(taskId)) {
      res.status(400).json({ error: "Invalid task id." });
      return;
    }

    try {
      await withTimeout(deleteDoc(doc(db, TASKS_COLLECTION, taskId)));
      res.json({ ok: true });
    } catch (error) {
      console.error("DELETE /api/tasks error:", error);
      res.status(503).json({
        error: formatFirestoreError(error, "Failed to delete task from Firestore."),
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*all", (_req, res) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build artifacts not found.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sahal Task server listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Fatal server startup error:", error);
  process.exit(1);
});
