import { getServerEnv } from "./env";

export type AppEnv = "development" | "staging" | "production";

function getAppEnv(): AppEnv {
  const env = getServerEnv();
  return (env.APP_ENV ?? env.NEXT_PUBLIC_APP_ENV ?? (env.NODE_ENV === "production" ? "production" : "development")) as AppEnv;
}

/** Single place for staging vs production behavior. */
export const config = {
  get env(): AppEnv {
    return getAppEnv();
  },

  get isProduction(): boolean {
    return this.env === "production";
  },

  get isStaging(): boolean {
    return this.env === "staging";
  },

  get isDev(): boolean {
    return this.env === "development";
  },

  get backendOrigin(): string {
    const env = getServerEnv();
    return (
      env.BACKEND_ORIGIN ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
  },

  get webUrl(): string {
    const env = getServerEnv();
    const fromEnv = env.NEXT_PUBLIC_WEB_URL?.trim();
    // `??` does not treat "" as missing — empty env would break `new URL("")` in metadata
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");
    return "http://localhost:3001";
  },

  get apiV1(): string {
    return `${this.backendOrigin}/api/v1`;
  },

  get analytics(): { gaId?: string; gtmId?: string; enabled: boolean } {
    const env = getServerEnv();
    const enabled = this.isProduction || this.isStaging;
    return {
      gaId: env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      gtmId: env.NEXT_PUBLIC_GTM_ID,
      enabled: enabled && !!(env.NEXT_PUBLIC_GA_MEASUREMENT_ID || env.NEXT_PUBLIC_GTM_ID),
    };
  },

  get imageCdn(): { baseUrl?: string; enabled: boolean } {
    const env = getServerEnv();
    const baseUrl = env.IMAGE_CDN_BASE_URL ?? process.env.NEXT_PUBLIC_CDN_IMAGE_BASE;
    return { baseUrl, enabled: !!baseUrl };
  },
} as const;
