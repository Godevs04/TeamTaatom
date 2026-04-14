"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  UserCircle,
  ShieldCheck,
  Bell,
  Palette,
  Cloud,
  Library,
  Info,
  UserPlus,
  Activity,
  FolderOpen,
  UserX,
  Monitor,
} from "lucide-react";
import { cn } from "../../../lib/utils";

// Order and items aligned with mobile app: Account, Privacy, Notifications, Appearance, Data,
// Collections, Activity Feed, Manage Posts, Follow requests, Account activity, Blocked users,
// Community Guidelines, Terms, Contact Support, About
const sections: { id: string; title: string; href: string; icon: React.ElementType }[] = [
  { id: "account", title: "Account", href: "/settings/account", icon: UserCircle },
  { id: "privacy", title: "Privacy & Security", href: "/settings/privacy", icon: ShieldCheck },
  { id: "notifications", title: "Notifications", href: "/settings/notifications", icon: Bell },
  { id: "appearance", title: "Appearance & Theme", href: "/settings/appearance", icon: Palette },
  { id: "data", title: "Data & Storage", href: "/settings/data", icon: Cloud },
  { id: "collections", title: "Collections", href: "/collections", icon: FolderOpen },
  { id: "activity", title: "Activity Feed", href: "/activity", icon: Activity },
  { id: "manage-posts", title: "Manage Posts", href: "/settings/manage-posts", icon: Library },
  { id: "follow-requests", title: "Follow Requests", href: "/settings/follow-requests", icon: UserPlus },
  { id: "account-activity", title: "Account Activity", href: "/settings/account-activity", icon: Monitor },
  { id: "blocked-users", title: "Blocked Users", href: "/settings/blocked-users", icon: UserX },
  { id: "about", title: "About", href: "/settings/about", icon: Info },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative">
      {/* Ambient styling (subtle, premium) */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-8 -bottom-10 overflow-hidden opacity-90"
        aria-hidden
      >
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-violet-500/[0.05] blur-3xl" />
        <div className="absolute left-1/3 top-64 h-56 w-56 rounded-full bg-sky-400/[0.04] blur-3xl" />
      </div>

      <div className="relative grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-10">
        {/* Side nav — desktop web pattern: categories on the left */}
        <aside className="lg:sticky lg:top-24 lg:self-start overflow-x-auto">
          <motion.nav
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-2 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70 sm:p-3 lg:p-3"
          >
            <h2 className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400 lg:block">
              Settings
            </h2>
            <ul className="space-y-0.5">
              {sections.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="settings-nav-pill"
                          className="absolute inset-0 -z-10 rounded-xl bg-primary shadow-lg shadow-primary/20"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <Icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.nav>
        </aside>

        {/* Content area — uses remaining width */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
