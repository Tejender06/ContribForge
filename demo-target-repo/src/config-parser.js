/**
 * micro-config: Configuration Loader
 * Handles parsing environment variables and configuration objects.
 */

export function parseHost(rawHost) {
  if (!rawHost || typeof rawHost !== "string" || rawHost.trim() === "") {
    return "127.0.0.1";
  }
  return rawHost.trim().toLowerCase();
}

export function parseLogLevel(rawLevel) {
  const allowed = ["debug", "info", "warn", "error"];
  const level = (rawLevel || "info").toLowerCase();
  return allowed.includes(level) ? level : "info";
}

/**
 * Parses and validates port configurations.
 * Expected behavior:
 * - If undefined, null, or empty string: default to 3000
 * - If valid integer between 1 and 65535: return the integer
 * - Otherwise: throw an Error with invalid port message
 */
export function parsePortConfig(rawPort) {
  // BUG (Issue #14): Directly calling .trim() throws TypeError if rawPort is undefined or null!
  const trimmed = rawPort.trim();
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
