type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown> & { message?: string; error?: unknown };

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const v = process.env.LOG_LEVEL?.toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const minLevel = getMinLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[minLevel];
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: String(err) };
}

function formatPayload(level: LogLevel, payload: LogPayload): string | object {
  const timestamp = new Date().toISOString();
  const base = { "@timestamp": timestamp, level, ...payload };
  if (payload.error !== undefined) {
    base.error = serializeError(payload.error);
  }
  if (process.env.NODE_ENV === "production" || process.env.LOG_JSON === "1") {
    return base;
  }
  const msg = payload.message ?? payload.msg ?? "";
  const rest = { ...payload };
  delete rest.message;
  delete rest.msg;
  delete rest.error;
  const restStr = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  return `[${timestamp}] ${level.toUpperCase()} ${msg}${restStr}`;
}

function log(level: LogLevel, messageOrPayload: string | LogPayload, payload?: LogPayload) {
  if (!shouldLog(level)) return;
  const p: LogPayload = typeof messageOrPayload === "string" ? { message: messageOrPayload, ...payload } : messageOrPayload;
  const out = formatPayload(level, p);
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (typeof out === "object") {
    fn(JSON.stringify(out));
  } else {
    fn(out);
  }
}

export const logger = {
  debug: (msg: string | LogPayload, payload?: LogPayload) => log("debug", msg, payload),
  info: (msg: string | LogPayload, payload?: LogPayload) => log("info", msg, payload),
  warn: (msg: string | LogPayload, payload?: LogPayload) => log("warn", msg, payload),
  error: (msg: string | LogPayload, payload?: LogPayload) => log("error", msg, payload),
};
