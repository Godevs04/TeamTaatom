"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search, PlusSquare, User2 } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-xs font-bold text-white shadow-sm">
              T
            </span>
            <span className="text-sm sm:text-base">Taatom</span>
          </Link>
          {!isLanding && (
            <nav className="hidden items-center gap-1.5 md:flex">
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
                    {active && mounted && (
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

        <div className="flex items-center gap-2">
          {!isLanding && (
            <>
              <Link href="/create" className="hidden sm:block">
                <Button className="gap-2 rounded-xl bg-primary px-4 text-white shadow-lg shadow-primary/20 hover:opacity-95">
                  <PlusSquare className="h-4 w-4" />
                  Create
                </Button>
              </Link>
              <Link href="/search">
                <Button variant="ghost" size="icon" aria-label="Search">
                  <Search className="h-5 w-5" />
                </Button>
              </Link>
          <Link href={mounted && user?._id ? `/profile/${user._id}` : "/"}>
            <Button variant="ghost" size="icon" aria-label="Profile">
              <User2 className="h-5 w-5" />
            </Button>
          </Link>
          {mounted && !isLoading && user && (
            <Button variant="ghost" onClick={signOut} className="hidden md:inline-flex">
              Sign out
            </Button>
          )}
            </>
          )}
          {isLanding && (!mounted || !user) && (
            <Link href="/auth/register">
              <Button variant="outline" className="rounded-full">
                Create account
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

