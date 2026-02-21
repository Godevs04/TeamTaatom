import { z } from "zod";

const appEnvSchema = z.enum(["development", "staging", "production"]);
export type AppEnv = z.infer<typeof appEnvSchema>;

/** Server-side env (safe to use in API routes, server components, next.config) */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: appEnvSchema.optional(),
  BACKEND_ORIGIN: z.string().url().optional(),
  NEXT_PUBLIC_WEB_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_ENV: appEnvSchema.optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_GTM_ID: z.string().optional(),
  IMAGE_CDN_BASE_URL: z.string().url().optional(),
});

/** Client-side env (only NEXT_PUBLIC_* are exposed to the browser) */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_WEB_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_ENV: appEnvSchema.optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_GTM_ID: z.string().optional(),
  NEXT_PUBLIC_CDN_IMAGE_BASE: z.string().url().optional(),
});

function parseServerEnv() {
  const raw = {
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    BACKEND_ORIGIN: process.env.BACKEND_ORIGIN,
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    IMAGE_CDN_BASE_URL: process.env.IMAGE_CDN_BASE_URL,
  };
  return serverEnvSchema.safeParse(raw);
}

function parseClientEnv() {
  const raw = {
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
    NEXT_PUBLIC_CDN_IMAGE_BASE: process.env.NEXT_PUBLIC_CDN_IMAGE_BASE,
  };
  return clientEnvSchema.safeParse(raw);
}

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

let _serverEnv: ServerEnv | null = null;
let _clientEnv: ClientEnv | null = null;

/** Validated server env. Throws at build/start if required vars are invalid. */
export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;
  const result = parseServerEnv();
  if (!result.success) {
    const msg = `Invalid server env: ${JSON.stringify(result.error.flatten().fieldErrors)}`;
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    // In dev, log and use defaults
    // eslint-disable-next-line no-console
    console.warn(msg);
    _serverEnv = {
      NODE_ENV: (process.env.NODE_ENV as "development" | "test" | "production") ?? "development",
      BACKEND_ORIGIN: process.env.BACKEND_ORIGIN,
      NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
      NEXT_PUBLIC_APP_ENV: (process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV) as AppEnv | undefined,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
      IMAGE_CDN_BASE_URL: process.env.IMAGE_CDN_BASE_URL,
    } as ServerEnv;
    return _serverEnv;
  }
  _serverEnv = result.data;
  return _serverEnv;
}

/** Validated client env. Use in client components or getServerEnv() in server. */
export function getClientEnv(): ClientEnv {
  if (typeof window !== "undefined" && _clientEnv) return _clientEnv;
  const result = parseClientEnv();
  if (!result.success) {
    if (process.env.NODE_ENV === "production") throw new Error("Invalid client env");
    _clientEnv = {};
    return _clientEnv as ClientEnv;
  }
  _clientEnv = result.data;
  return _clientEnv;
}

/** Validate env at module load (optional, call from instrumentation or layout). */
export function validateEnv(): { server: boolean; client: boolean } {
  const server = parseServerEnv().success;
  const client = parseClientEnv().success;
  return { server, client };
}
