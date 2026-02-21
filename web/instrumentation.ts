/**
 * Next.js instrumentation: runs once when the server starts.
 * Use to validate env and bootstrap logging.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    const { logger } = await import("./lib/logger");
    const result = validateEnv();
    if (!result.server) {
      logger.warn("Server env validation reported issues. Check .env.local and .env.example.");
    }
  }
}
