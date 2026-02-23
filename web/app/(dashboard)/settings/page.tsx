"use client";

import Link from "next/link";
import {
  UserCircle,
  ShieldCheck,
  Flag,
  Bell,
  Palette,
  Cloud,
  Library,
  Activity,
  FileText,
  Mail,
  Info,
  ChevronRight,
} from "lucide-react";

const settingsSections: { id: string; title: string; description: string; href: string; icon: React.ElementType }[] = [
  { id: "account", title: "Account", description: "Profile info, language, data usage, and account actions", href: "/settings/account", icon: UserCircle },
  { id: "privacy", title: "Privacy & Security", description: "Profile visibility, communication controls, and security", href: "/settings/privacy", icon: ShieldCheck },
  { id: "content-policy", title: "Community Guidelines", description: "Safety policy, content rules, report & block", href: "/settings/content-policy", icon: Flag },
  { id: "notifications", title: "Notifications", description: "Push notifications, email alerts, and activity settings", href: "/settings/notifications", icon: Bell },
  { id: "appearance", title: "Appearance & Theme", description: "Theme settings, display options, and visual effects", href: "/settings/appearance", icon: Palette },
  { id: "data", title: "Data & Storage", description: "Storage usage, cache management, and sync settings", href: "/settings/data", icon: Cloud },
  { id: "collections", title: "Collections", description: "Organise your trips and posts", href: "/collections", icon: Library },
  { id: "activity", title: "Activity Feed", description: "See what your friends are up to", href: "/activity", icon: Activity },
  { id: "terms", title: "Terms & Conditions", description: "User agreement and content policy", href: "/settings/terms", icon: FileText },
  { id: "manage-posts", title: "Manage Posts", description: "View and restore archived or hidden posts", href: "/settings/manage-posts", icon: Library },
  { id: "contact-support", title: "Contact Support", description: "Get help from our team", href: "/settings/contact-support", icon: Mail },
  { id: "about", title: "About", description: "App version, support, and legal information", href: "/settings/about", icon: Info },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">Settings</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage your account and preferences.</p>
        <ul className="mt-6 space-y-1">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <li key={section.id}>
                <Link
                  href={section.href}
                  className="flex items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-zinc-800/80"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{section.title}</p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">{section.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
