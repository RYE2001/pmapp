import { Request, Response } from "express";

export type ProjectEvent = {
  type: string;
  taskId?: string;
};

const subscribers = new Map<string, Set<Response>>();

function writeEvent(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

// Streams are authenticated by the normal Authorization header rather than a token in the URL.
export function openProjectEventStream(req: Request, res: Response, projectId: string) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  writeEvent(res, "ready", {});

  const projectSubscribers = subscribers.get(projectId) ?? new Set<Response>();
  projectSubscribers.add(res);
  subscribers.set(projectId, projectSubscribers);

  const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    projectSubscribers.delete(res);
    if (projectSubscribers.size === 0) subscribers.delete(projectId);
  });
}

export function publishProjectEvent(projectId: string, event: ProjectEvent) {
  const projectSubscribers = subscribers.get(projectId);
  if (!projectSubscribers) return;

  for (const response of projectSubscribers) {
    if (response.writableEnded || response.destroyed) {
      projectSubscribers.delete(response);
      continue;
    }
    writeEvent(response, "project", event);
  }
  if (projectSubscribers.size === 0) subscribers.delete(projectId);
}
