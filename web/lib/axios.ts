import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_V1_PROXY, STORAGE_KEYS } from "./constants";
import { getCookie } from "./utils";

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function getFallbackBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEYS.webFallbackToken);
}

export const api = axios.create({
  baseURL: API_V1_PROXY,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    "X-Platform": "web",
  },
});

api.interceptors.request.use((config: RetryConfig) => {
  // CSRF for state-changing methods (backend expects X-CSRF-Token on web)
  const method = (config.method || "get").toUpperCase();
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isStateChanging) {
    const csrf = getCookie("csrf-token");
    if (csrf) {
      config.headers["X-CSRF-Token"] = csrf;
    }
  }

  // Dev cross-origin fallback: backend may return token in response instead of cookie
  const bearer = getFallbackBearerToken();
  if (bearer) {
    config.headers.Authorization = `Bearer ${bearer}`;
  }

  config.headers["X-Platform"] = "web";
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const config = err.config as RetryConfig | undefined;
    if (!config) throw err;

    const status = err.response?.status;
    const url = config.url || "";

    // Only attempt refresh if we actually have some auth state
    const hasToken = !!getFallbackBearerToken() || (typeof window !== "undefined" && !!getCookie("authToken"));

    if (status === 401 && !config._retry && hasToken) {
      // Never try to refresh for the refresh call itself or other auth endpoints
      if (url.includes("/auth/refresh") || url.includes("/auth/signin") || url.includes("/auth/signup")) {
        throw err;
      }

      config._retry = true;
      try {
        // Refresh session (cookie mode) or refresh bearer (if supported by backend)
        await api.post("/auth/refresh");
        return api.request(config);
      } catch {
        // fallthrough: propagate original error
      }
    }

    throw err;
  }
);

