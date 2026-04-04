import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth routes that logged-in users should not see (redirect to feed)
const AUTH_ROUTES = ["/auth/login", "/auth/register"];

// Protect routes that require auth; redirect to landing (login) when not authenticated
const PROTECTED_PREFIXES = [
  "/feed",
  "/shorts",
  "/saved",
  "/locale",
  "/search",
  "/create",
  "/profile",
  "/trip",
  "/settings",
  "/collections",
  "/activity",
  "/chat",
  "/notifications",
];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const hasCookieToken = !!req.cookies.get("authToken")?.value;
  const hasDevAuth = !!req.cookies.get("devAuth")?.value;
  const isLoggedIn = hasCookieToken || hasDevAuth;

  // If already logged in and trying to access login/register, redirect to feed
  if (isAuthRoute(pathname) && isLoggedIn) {
    const url = req.nextUrl.clone();
    const next = url.searchParams.get("next");
    url.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isProtected(pathname)) return NextResponse.next();

  if (isLoggedIn) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("next", `${pathname}${search || ""}`);
  return NextResponse.redirect(url);
}

// Keep in sync with PROTECTED_PREFIXES and AUTH_ROUTES (Next.js requires static matcher)
export const config = {
  matcher: [
    "/auth/login",
    "/auth/login/:path*",
    "/auth/register",
    "/auth/register/:path*",
    "/feed",
    "/feed/:path*",
    "/shorts",
    "/shorts/:path*",
    "/saved",
    "/saved/:path*",
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
    "/notifications",
    "/notifications/:path*",
  ],
};
