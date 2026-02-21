"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search, PlusSquare, User2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useAuth } from "../../context/auth-context";

const nav = [
  { href: "/feed", label: "Feed" },
  { href: "/search", label: "Search" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              T
            </span>
            <span className="text-sm sm:text-base">Taatom</span>
          </Link>
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
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-slate-100"
                    />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/create" className="hidden sm:block">
            <Button variant="outline" className="gap-2 rounded-full border-slate-200">
              <PlusSquare className="h-4 w-4" />
              Create
            </Button>
          </Link>
          <Link href="/search">
            <Button variant="ghost" size="icon" aria-label="Search">
              <Search className="h-5 w-5" />
            </Button>
          </Link>
          <Link href={user?._id ? `/profile/${user._id}` : "/auth/login"}>
            <Button variant="ghost" size="icon" aria-label="Profile">
              <User2 className="h-5 w-5" />
            </Button>
          </Link>
          {!isLoading && user && (
            <Button variant="ghost" onClick={signOut} className="hidden md:inline-flex">
              Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

