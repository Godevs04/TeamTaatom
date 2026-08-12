"use client";

import { io, type Socket } from "socket.io-client";

/**
 * Matches the backend's default `WS_PATH` (`backend/src/socket/index.js`).
 * Hardcoded rather than env-driven, mirroring mobile's `WS_PATH` constant
 * (`frontend/utils/config.ts`) -- if the backend ever overrides `WS_PATH`,
 * this constant and `NEXT_PUBLIC_SOCKET_ORIGIN` both need updating together.
 */
const WS_PATH = "/socket.io";

/**
 * Absolute backend origin for the browser's direct WebSocket connection.
 *
 * Unlike REST (which goes through Next's same-origin `/api/v1` rewrite, so
 * the browser never needs to know the backend's real origin), a WebSocket
 * handshake has no proxy option here -- the browser must open a connection
 * directly to the backend. That means it needs a `NEXT_PUBLIC_`-prefixed
 * env var: `constants.ts`'s `BACKEND_ORIGIN` is intentionally server-only
 * (see `web/lib/env.ts`'s server/client schema split) and resolves to
 * `undefined` in a client bundle, so referencing it here would silently
 * fall through to the "http://localhost:3000" literal for every real user
 * in production. `NEXT_PUBLIC_SOCKET_ORIGIN` must be set in the deployed
 * web app's env for this to work in production -- see env.example.
 */
function getSocketOrigin(): string {
  const origin =
    process.env.NEXT_PUBLIC_SOCKET_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:3000";
  return origin.replace(/\/$/, "");
}

let socket: Socket | null = null;

/**
 * Connect once per authenticated session (idempotent -- returns the existing
 * socket if already connected/connecting). `withCredentials: true` sends the
 * httpOnly `authToken` cookie on the handshake; no bearer token is used as
 * the primary path, since in production the browser never has the JWT to
 * send (see backend/src/utils/authHelpers.js's setAuthToken). Basic
 * reconnection is all that's needed here -- mobile's manual message-queue/
 * backoff machinery in frontend/services/socket.ts exists for spotty
 * cellular connections, a much weaker case on web.
 */
export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(`${getSocketOrigin()}/app`, {
    path: WS_PATH,
    withCredentials: true,
    reconnection: true,
  });
  return socket;
}

/** Tear down the socket. Hang this off the same place as sign-out cleanup. */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

export function isSocketConnected(): boolean {
  return !!socket?.connected;
}

/**
 * Subscribe to a socket event, connecting lazily if no socket exists yet
 * (e.g. a chat page's effect racing auth-context's connect-on-sign-in
 * effect). Always pair with `unsubscribeSocket` in a cleanup function.
 */
export function subscribeSocket<T = unknown>(event: string, cb: (payload: T) => void): void {
  connectSocket().on(event, cb as (...args: unknown[]) => void);
}

export function unsubscribeSocket<T = unknown>(event: string, cb: (payload: T) => void): void {
  socket?.off(event, cb as (...args: unknown[]) => void);
}

/** Emit a socket event, connecting lazily if needed (see subscribeSocket). */
export function emitSocket(event: string, payload?: unknown): void {
  connectSocket().emit(event, payload);
}
