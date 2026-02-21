import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect key routes that require auth (cookie authToken in prod; dev fallback uses devAuth flag)
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/create") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/collections") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/chat");

  if (!isProtected) return NextResponse.next();

  const hasCookieToken = !!req.cookies.get("authToken")?.value;
  const hasDevAuth = !!req.cookies.get("devAuth")?.value;

  if (hasCookieToken || hasDevAuth) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("next", `${pathname}${search || ""}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/create/:path*", "/settings/:path*", "/collections/:path*", "/activity/:path*", "/chat/:path*"],
};

