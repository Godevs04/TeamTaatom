import { getServerEnv } from "./env";

export type AppEnv = "development" | "staging" | "production";

/** Env sometimes contains literal "null"/"undefined"; treat as unset so metadata URLs stay valid */
function sanitizePublicWebUrl(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = String(raw).trim();
  if (!t || /^null$/i.test(t) || /^undefined$/i.test(t)) return undefined;
  return t;
}

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
    const PRODUCTION_SITE = "https://taatom.com";
    const env = getServerEnv();
    const fromEnv = sanitizePublicWebUrl(env.NEXT_PUBLIC_WEB_URL);

    const toOrigin = (raw: string, fallbackProtocol: "http" | "https"): string | null => {
      try {
        const href =
          raw.startsWith("http://") || raw.startsWith("https://")
            ? raw
            : `${fallbackProtocol}://${raw}`;
        return new URL(href).origin.replace(/\/$/, "");
      } catch {
        return null;
      }
    };

    if (fromEnv) {
      const origin = toOrigin(fromEnv, this.isProduction || this.isStaging ? "https" : "http");
      if (origin) {
        // Never publish localhost / private hosts in prod sitemaps (Search Console
        // flags every entry as "URL not allowed" against taatom.com).
        if (
          (this.isProduction || this.isStaging || process.env.NODE_ENV === "production") &&
          /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin)
        ) {
          return PRODUCTION_SITE;
        }
        return origin;
      }
    }

    if (this.isProduction || this.isStaging || process.env.NODE_ENV === "production") {
      return PRODUCTION_SITE;
    }

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
