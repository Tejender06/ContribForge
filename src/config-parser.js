/**
 * micro-config: Configuration Loader
 * Handles parsing environment variables and configuration objects.
 */

export function parseHost(rawHost) {
  if (!rawHost || typeof rawHost !== "string" || rawHost.trim() === "") {
    return "127.0.0.1";
  }
  return rawHost.replace(/^https?:\/\//i, "").trim().toLowerCase();
}

export function parseLogLevel(rawLevel) {
  const allowed = ["debug", "info", "warn", "error"];
  const level = String(rawLevel || "info").trim().toLowerCase();
  return allowed.includes(level) ? level : "info";
}

/**
 * Parses and validates port configurations.
 * Fixed: Handles undefined, null, and empty strings gracefully, defaulting to 3000.
 * Rejects negative or out-of-range port numbers.
 */
export function parsePortConfig(rawPort) {
  if (rawPort === undefined || rawPort === null || (typeof rawPort === "string" && rawPort.trim() === "")) {
    return 3000;
  }
  const trimmed = typeof rawPort === "string" ? rawPort.trim() : String(rawPort);
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port: "${rawPort}"`);
  }
  return parsed;
}

export function loadConfig(env = process.env) {
  return {
    host: parseHost(env.HOST),
    port: parsePortConfig(env.PORT),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    dbUrl: env.DATABASE_URL || "sqlite://:memory:"
  };
}
