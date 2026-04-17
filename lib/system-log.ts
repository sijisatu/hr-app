import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type SystemLogLevel = "info" | "warn" | "error";

type SystemLogPayload = {
  source: string;
  event: string;
  level?: SystemLogLevel;
  details?: Record<string, unknown>;
};

function resolveProjectRoot() {
  const cwd = process.cwd();
  return path.basename(cwd).toLowerCase() === "backend" ? path.resolve(cwd, "..") : cwd;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null
    };
  }
  return error;
}

export async function writeSystemLog(payload: SystemLogPayload) {
  try {
    const projectRoot = resolveProjectRoot();
    const targetDir = path.join(projectRoot, "logs", "system");
    const targetFile = path.join(targetDir, "system-events.ndjson");
    await mkdir(targetDir, { recursive: true });
    const record = {
      timestamp: new Date().toISOString(),
      level: payload.level ?? "info",
      source: payload.source,
      event: payload.event,
      details: payload.details ?? null
    };
    await appendFile(`${targetFile}`, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    console.error("Failed to write system log", serializeError(error));
  }
}

export function toLoggableError(error: unknown) {
  return serializeError(error);
}
