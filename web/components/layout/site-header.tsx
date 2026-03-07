"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search, PlusSquare, User2, Bell } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useAuth } from "../../context/auth-context";
import { useMounted } from "../../hooks/use-mounted";

const nav = [
  { href: "/feed", label: "Feed" },
  { href: "/search", label: "Search" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { user, isLoading, signOut } = useAuth();
  const isLanding = pathname === "/";
  const isAuthPage = isLanding || (pathname?.startsWith("/auth") ?? false);
  const showAppNav = mounted && user && !isAuthPage;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-14 min-h-[3.5rem] max-w-6xl items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-shrink items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png?v=2" alt="Taatom" className="h-8 w-8 rounded-xl object-contain" />
            <span className="text-sm sm:text-base">Taatom</span>
          </Link>
          {showAppNav && (
            <nav className="hidden items-center gap-1 sm:flex sm:gap-1.5">
              {nav.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground",
                      active && "text-foreground"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 -z-10 rounded-full bg-slate-100"
                      />
                    )}
                    {active && !mounted && (
                      <span
                        aria-hidden
                        className="absolute inset-0 -z-10 rounded-full bg-slate-100"
                      />
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          {showAppNav ? (
            <>
              <Link href="/create">
                <Button className="gap-2 rounded-xl bg-primary px-3 text-white shadow-lg shadow-primary/20 hover:opacity-95 sm:px-4">
                  <PlusSquare className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </Link>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/search">
                <Button variant="ghost" size="icon" aria-label="Search">
                  <Search className="h-5 w-5" />
                </Button>
              </Link>
              <Link href={user?._id ? `/profile/${user._id}` : "/"}>
                <Button variant="ghost" size="icon" aria-label="Profile">
                  <User2 className="h-5 w-5" />
                </Button>
              </Link>
              {!isLoading && (
                <Button variant="ghost" onClick={signOut} className="hidden md:inline-flex">
                  Sign out
                </Button>
              )}
            </>
          ) : (
            <>
              {(!mounted || !user) && (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost" className="rounded-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button variant="outline" className="rounded-full">
                      Create account
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

