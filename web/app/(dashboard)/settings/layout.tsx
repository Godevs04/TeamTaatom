"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-10">
      {/* Side nav — desktop web pattern: categories on the left */}
      <aside className="lg:sticky lg:top-24 lg:self-start overflow-x-auto">
        <nav className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/95 sm:p-3 lg:p-3">
          <h2 className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-widest text-slate-500 lg:block">
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
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Content area — uses remaining width */}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
