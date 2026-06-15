import { isAxiosError } from "axios";

function getNestedApiMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const err = o.error;
  if (err && typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0 && m.length < 400) return m;
  }
  return undefined;
}

/**
 * Returns a user-friendly message for auth API errors (signup, signin, forgot, etc.)
 * so we never show technical text like "Request failed with status code 409".
 */
/** True when backend rejects sign-in because the account email is not verified yet. */
export function isVerifyRequiredError(error: unknown): boolean {
  const err = error as {
    response?: {
      data?: {
        code?: string;
        message?: string;
        error?: string | { code?: string; message?: string };
      };
    };
  };
  const data = err?.response?.data;
  const nested = data?.error;
  const code =
    (typeof nested === "object" && nested !== null ? nested.code : undefined) ??
    (typeof nested === "string" ? nested : undefined) ??
    data?.code ??
    "";
  const message = (
    (typeof nested === "object" && nested !== null ? nested.message : undefined) ??
    data?.message ??
    ""
  ).toLowerCase();

  return (
    code === "AUTH_1005" ||
    code === "AUTH_1006" ||
    code === "VERIFY_REQUIRED" ||
    message.includes("verify") ||
    message.includes("verification") ||
    message.includes("not verified")
  );
}

export function getFriendlyAuthErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    const serverMessage = data?.message ?? data?.error;

    if (typeof serverMessage === "string" && serverMessage.length > 0 && serverMessage.length < 200) {
      // Prefer backend message if it looks user-facing (short, no stack traces)
      if (!/^\s*request failed|status code \d+|axios|ECONNREFUSED|ETIMEDOUT/i.test(serverMessage)) {
        return serverMessage;
      }
    }

    switch (status) {
      case 400:
        return "Please check your details and try again.";
      case 401:
        return "Invalid email or password. Please try again.";
      case 409:
        return "This email or username is already registered. Try signing in or use a different email.";
      case 429:
        return "Too many attempts. Please wait a moment and try again.";
      case 500:
      case 502:
      case 503:
        return "Something went wrong on our end. Please try again in a few minutes.";
      default:
        if (error.code === "ECONNREFUSED" || error.message?.includes("Network")) {
          return "Unable to connect. Please check your internet and try again.";
        }
        return "Something went wrong. Please try again.";
    }
  }

  if (error instanceof Error && error.message) {
    if (/network|connection|fetch/i.test(error.message)) {
      return "Unable to connect. Please check your internet and try again.";
    }
  }

  return "Something went wrong. Please try again.";
}

/**
 * Returns a user-friendly message for any API or request error (posts, shorts, settings, etc.)
 * so we never show technical text like "Request failed with status code 400".
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    const nested = getNestedApiMessage(error.response?.data);
    const flat =
      typeof data?.message === "string"
        ? data.message
        : typeof data?.error === "string"
          ? data.error
          : undefined;
    const serverMessage = nested ?? flat;

    if (typeof serverMessage === "string" && serverMessage.length > 0 && serverMessage.length < 400) {
      if (!/^\s*request failed|status code \d+|axios|ECONNREFUSED|ETIMEDOUT/i.test(serverMessage)) {
        return serverMessage;
      }
    }

    switch (status) {
      case 400:
        return "Please check your details and try again.";
      case 401:
        return "Please sign in again.";
      case 403:
        return "You don't have permission to do that.";
      case 404:
        return "That item wasn't found.";
      case 409:
        return "This conflicts with existing data. Please try something else.";
      case 429:
        return "Too many attempts. Please wait a moment and try again.";
      case 503:
        return (
          nested ||
          flat ||
          "Payments are temporarily unavailable. Please try again later."
        );
      case 500:
      case 502:
        return "Something went wrong on our end. Please try again in a few minutes.";
      default:
        if (error.code === "ECONNREFUSED" || error.message?.includes("Network")) {
          return "Unable to connect. Please check your internet and try again.";
        }
        return "Something went wrong. Please try again.";
    }
  }

  if (error instanceof Error && error.message) {
    if (/network|connection|fetch|timeout/i.test(error.message)) {
      return "Unable to connect. Please check your internet and try again.";
    }
  }

  return "Something went wrong. Please try again.";
}

/** Useful for feed/session UX: show sign-in CTA when the API returns 401. */
export function isUnauthorizedError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}

/** Alias for getFriendlyErrorMessage — use for any API error (feed, settings, etc.). */
export const getUserFacingErrorMessage = getFriendlyErrorMessage;
