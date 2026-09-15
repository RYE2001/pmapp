import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import timeEntryRoutes from "./routes/timeEntries";
import reportRoutes from "./routes/reports";
import blockerRoutes from "./routes/blockers";
import eventRoutes from "./routes/events";
import decisionRoutes from "./routes/decisions";
import resourceRoutes from "./routes/resources";
import scenarioRoutes from "./routes/scenarios";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/time-entries", timeEntryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/blockers", blockerRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/decisions", decisionRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/scenarios", scenarioRoutes);

// Catch-all error handler so unexpected failures return JSON, not an HTML stack trace.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
