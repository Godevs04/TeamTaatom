/**
 * Next.js instrumentation: runs once when the server starts.
 * Use to validate env and bootstrap logging.
 * In production, BACKEND_ORIGIN is required (fail fast if missing).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    const { logger } = await import("./lib/logger");
    if (process.env.NODE_ENV === "production") {
      const origin = process.env.BACKEND_ORIGIN;
      if (!origin || origin === "http://localhost:3000") {
        throw new Error(
          "BACKEND_ORIGIN must be set to your backend URL in production. Do not use localhost."
        );
      }
    }
    const result = validateEnv();
    if (!result.server) {
      logger.warn("Server env validation reported issues. Check .env.local and .env.example.");
    }
  }
}
