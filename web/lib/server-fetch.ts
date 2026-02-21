import { cookies } from "next/headers";

export async function fetchWithAuth(url: string, init?: RequestInit) {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.toString();

  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "X-Platform": "web",
    },
    // authenticated resources should not be cached by default
    cache: init?.cache ?? "no-store",
  });
}

