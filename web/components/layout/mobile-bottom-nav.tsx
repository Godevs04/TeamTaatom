"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusSquare,
  User2,
  Bell,
  PlayCircle,
  MapPinned,
  Search,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/auth-context";
import { useMounted } from "../../hooks/use-mounted";

const mainNav = [
  { href: "/feed", label: "Feed", icon: LayoutDashboard },
  { href: "/shorts", label: "Shorts", icon: PlayCircle },
  { href: "/create", label: "Create", icon: PlusSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User2 },
];

const moreNav = [
  { href: "/locale", label: "Locale", icon: MapPinned },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const profileHref = mounted && user?._id ? `/profile/${user._id}` : "/profile";

  return (
    <>
      {/* Bottom nav — visible only when sidebar is hidden (lg:hidden in shell) */}
      <nav
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 border-t border-slate-200/80 bg-white/95 pt-2 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.1)] backdrop-blur-xl lg:hidden"
        aria-label="Main navigation"
      >
        {mainNav.map((item) => {
          const href = item.href === "/profile" ? profileHref : item.href;
          const active =
            pathname === href ||
            (item.href !== "/feed" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl transition-colors",
                active
                  ? "text-primary"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.href === "/create" ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 sm:h-10 sm:w-10">
                  <PlusSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
              ) : (
                <Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
              )}
              <span className="truncate w-full text-center text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl transition-colors text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
          <span className="truncate w-full text-center text-[10px] font-medium leading-tight">More</span>
        </button>
      </nav>

      {/* More overlay — full-screen list for Locale, Search, Settings */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            aria-hidden
            onClick={() => setMoreOpen(false)}
          />
          <div
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="More options"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="divide-y divide-slate-100 p-2">
              {moreNav.map((item) => {
                const Icon = item.icon;
                const href = item.href;
                const active = pathname === href || pathname?.startsWith(href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors",
                        active
                          ? "bg-primary text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="h-6 shrink-0" />
          </div>
        </>
      )}
    </>
  );
}
