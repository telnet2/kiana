export type LogLevel = "info" | "warn" | "error" | "debug";

export type Logger = {
  log: (level: LogLevel, message: string, detail?: unknown) => void;
  info: (message: string, detail?: unknown) => void;
  warn: (message: string, detail?: unknown) => void;
  error: (message: string, detail?: unknown) => void;
  debug: (message: string, detail?: unknown) => void;
};

const write = (level: LogLevel, message: string, detail?: unknown) => {
  const payload = detail === undefined ? message : `${message} ${JSON.stringify(detail)}`;
  if (level === "info") {
    console.info(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  if (level === "error") {
    console.error(payload);
    return;
  }
  console.debug(payload);
};

export const createLogger = (prefix?: string): Logger => {
  const format = (message: string) => (prefix ? `[${prefix}] ${message}` : message);
  const log = (level: LogLevel, message: string, detail?: unknown) => write(level, format(message), detail);
  const info = (message: string, detail?: unknown) => log("info", message, detail);
  const warn = (message: string, detail?: unknown) => log("warn", message, detail);
  const error = (message: string, detail?: unknown) => log("error", message, detail);
  const debug = (message: string, detail?: unknown) => log("debug", message, detail);
  return { log, info, warn, error, debug };
};
