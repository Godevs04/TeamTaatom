import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BACKEND_ORIGIN } from "./lib/constants";

// Auth routes that logged-in users should not see (redirect to feed)
const AUTH_ROUTES = ["/auth/login", "/auth/register"];

// Protect routes that require auth; redirect to landing (login) when not authenticated
const PROTECTED_PREFIXES = [
  "/onboarding",
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Intercept download requests for smart redirection
  if (pathname === "/download" || pathname.startsWith("/download/")) {
    const userAgent = req.headers.get("user-agent") || "";
    const isAndroid = /Android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    
    if (isAndroid) {
      return NextResponse.redirect("https://play.google.com/store/search?q=taatom&c=apps&hl=en");
    } else if (isIOS) {
      return NextResponse.redirect("https://apps.apple.com/app/id6757185352");
    }
  }

  // Intercept short URLs
  if (pathname.startsWith("/s/")) {
    const match = pathname.match(/^\/s\/([^\/]+)$/);
    const shortCode = match ? match[1] : null;
    if (shortCode) {
      try {
        const res = await fetch(`${BACKEND_ORIGIN}/s/${shortCode}`);
        if (res.status === 200) {
          const html = await res.text();
          
          // Check if request is from a mobile browser
          const userAgent = req.headers.get("user-agent") || "";
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
          
          if (isMobile) {
            // For mobile, return the backend's redirect HTML page directly
            // This page contains scripts to open the app via custom deep links (taatom://)
            return new NextResponse(html, {
              headers: {
                "Content-Type": "text/html; charset=utf-8",
              },
            });
          }

          const urlMatch = html.match(/universalLink\s*=\s*['"]([^'"]+)['"]/);
          if (urlMatch && urlMatch[1]) {
            const targetUrl = new URL(urlMatch[1]);
            let path = targetUrl.pathname;
            if (path.startsWith("/journey/")) {
              const id = path.substring("/journey/".length);
              path = `/journeys/${id}`;
            } else if (path.startsWith("/post/")) {
              const id = path.substring("/post/".length);
              path = `/trip/${id}`;
            }
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = path;
            redirectUrl.search = ""; // clear short URL search parameters
            return NextResponse.redirect(redirectUrl);
          }
        }
      } catch (err) {
        console.error("Error resolving short URL:", err);
      }
    }
  }

  // Intercept universal link paths directly accessed on web
  if (pathname.startsWith("/post/")) {
    const id = pathname.substring(6);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = `/trip/${id}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/journey/")) {
    const id = pathname.substring(9);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = `/journeys/${id}`;
    return NextResponse.redirect(redirectUrl);
  }

  // Cashfree subscription return_url may receive POST (form body); pages only handle GET.
  if (req.method === "POST" && /^\/connect\/page\/[^/]+$/.test(pathname)) {
    const url = req.nextUrl.clone();
    return NextResponse.redirect(url, 303);
  }

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
  url.searchParams.set("next", `${pathname}${req.nextUrl.search || ""}`);
  return NextResponse.redirect(url);
}

// Keep in sync with PROTECTED_PREFIXES and AUTH_ROUTES (Next.js requires static matcher)
export const config = {
  matcher: [
    "/download",
    "/download/:path*",
    "/s/:path*",
    "/post/:path*",
    "/journey/:path*",
    "/onboarding",
    "/onboarding/:path*",
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
    "/connect/page/:path*",
  ],
};
