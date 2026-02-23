import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect routes that require auth; redirect to landing (login) when not authenticated
const PROTECTED_PREFIXES = [
  "/feed",
  "/shorts",
  "/locale",
  "/search",
  "/create",
  "/profile",
  "/trip",
  "/settings",
  "/collections",
  "/activity",
  "/chat",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const hasCookieToken = !!req.cookies.get("authToken")?.value;
  const hasDevAuth = !!req.cookies.get("devAuth")?.value;

  if (hasCookieToken || hasDevAuth) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("next", `${pathname}${search || ""}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/feed",
    "/feed/:path*",
    "/shorts",
    "/shorts/:path*",
    "/locale",
    "/locale/:path*",
    "/search",
    "/search/:path*",
    "/create",
    "/create/:path*",
    "/profile/:path*",
    "/trip/:path*",
    "/settings",
    "/settings/:path*",
    "/collections",
    "/collections/:path*",
    "/activity",
    "/activity/:path*",
    "/chat/:path*",
  ],
};
