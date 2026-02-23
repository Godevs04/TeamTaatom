"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  PlusSquare,
  User2,
  Settings,
  Smartphone,
  MapPin,
  Music,
  Utensils,
  Mountain,
  MapPinned,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/auth-context";
import { useMounted } from "../../hooks/use-mounted";

const leftNav = [
  { href: "/feed", label: "News Feed", icon: LayoutDashboard },
  { href: "/shorts", label: "Shorts", icon: PlayCircle },
  { href: "/locale", label: "Locale", icon: MapPinned },
  { href: "/search", label: "Search", icon: Search },
  { href: "/create", label: "Create", icon: PlusSquare },
  { href: "/profile", label: "Profile", icon: User2 },
];

const recommendations = [
  { label: "Travel", icon: MapPin, href: "/search?q=travel", color: "from-emerald-500/15 to-teal-500/10" },
  { label: "Music", icon: Music, href: "/search?q=music", color: "from-violet-500/15 to-purple-500/10" },
  { label: "Food", icon: Utensils, href: "/search?q=food", color: "from-amber-500/15 to-orange-500/10" },
  { label: "Adventure", icon: Mountain, href: "/search?q=adventure", color: "from-sky-500/15 to-blue-500/10" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const { user } = useAuth();
  const profileHref = mounted && user?._id ? `/profile/${user._id}` : "/feed";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full bg-[#f8fafc]">
      {/* Left sidebar — premium card style */}
      <aside className="hidden w-[280px] shrink-0 flex-col lg:flex">
        <div className="sticky top-20 flex flex-col gap-6 p-5">
          {/* Profile block */}
          <Link
            href={profileHref}
            className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-premium transition-all duration-200 hover:shadow-premium-hover border-premium border"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/20 ring-1 ring-black/5">
              {mounted && user?.profilePic ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.profilePic}
                  alt={user?.fullName || "Profile"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User2 className="h-7 w-7 text-primary/70" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                {mounted ? (user?.fullName || "Traveler") : "…"}
              </div>
              <div className="truncate text-xs font-medium text-slate-500">
                @{mounted ? (user?.username || "user") : "…"}
              </div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="space-y-1">
            {leftNav.map((item) => {
              const active = pathname === item.href || (item.href !== "/feed" && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href === "/profile" ? profileHref : item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-all duration-200",
                    active
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-premium border-premium hover:border"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 opacity-90" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-slate-600 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-premium border-premium hover:border"
            >
              <Settings className="h-5 w-5 shrink-0" />
              Settings
            </Link>
          </nav>

          {/* Download app — premium CTA */}
          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 p-5 shadow-premium border-premium">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Download the App</p>
                <p className="text-xs text-slate-500">Best experience on mobile</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Get the full Taatom experience with offline maps and instant sharing.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[640px] px-4 py-8 md:px-6 lg:px-10">{children}</div>
      </div>

      {/* Right sidebar — Suggestions & Recommendations */}
      <aside className="hidden w-[320px] shrink-0 flex-col gap-8 p-6 xl:flex">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-premium border-premium">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Discover
            </h3>
          </div>
          <p className="text-[15px] leading-relaxed text-slate-600">
            <Link href="/search" className="font-semibold text-primary hover:underline">
              Find travelers
            </Link>{" "}
            to follow and see their trips in your feed.
          </p>
          <Link
            href="/search"
            className="mt-4 inline-flex items-center text-sm font-semibold text-primary hover:underline"
          >
            See all →
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-premium border-premium">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Recommendations
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {recommendations.map((rec) => {
              const Icon = rec.icon;
              return (
                <Link
                  key={rec.label}
                  href={rec.href}
                  className={cn(
                    "group flex flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br py-6 transition-all duration-200 hover:shadow-premium-hover border border-slate-200/80",
                    rec.color
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm group-hover:bg-white">
                    <Icon className="h-6 w-6 text-slate-700" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{rec.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}
