import type { LucideIcon } from "lucide-react";
import {
  UserCircle,
  ShieldCheck,
  Library,
  Palette,
  Bell,
  FolderOpen,
  Activity,
  UserPlus,
  Monitor,
  UserX,
  Route,
  Flag,
  FileText,
  PhoneCall,
  Info,
  HelpCircle,
  Bookmark,
  Cloud,
} from "lucide-react";

export type SettingsNavItem = {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type SettingsNavGroup = {
  id: string;
  title: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: "profile",
    title: "Profile & Identity",
    items: [
      { id: "account", title: "Profile", href: "/settings/account", icon: UserCircle, description: "Photo, name, bio" },
    ],
  },
  {
    id: "security",
    title: "Account & Security",
    items: [
      { id: "account-security", title: "Security", href: "/settings/account#security", icon: ShieldCheck, description: "Password & verification" },
      { id: "account-activity", title: "Sessions & Activity", href: "/settings/account-activity", icon: Monitor, description: "Devices & login history" },
      { id: "notifications", title: "Notifications", href: "/settings/notifications", icon: Bell, description: "Alerts & email" },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Community",
    items: [
      { id: "privacy", title: "Visibility", href: "/settings/privacy", icon: ShieldCheck, description: "Who can see & message you" },
      { id: "follow-requests", title: "Follow Requests", href: "/settings/follow-requests", icon: UserPlus },
      { id: "blocked-users", title: "Blocked Users", href: "/settings/blocked-users", icon: UserX },
      { id: "route-access", title: "Route Access", href: "/settings/route-access-requests", icon: Route },
      { id: "content-policy", title: "Community Guidelines", href: "/settings/content-policy", icon: Flag },
    ],
  },
  {
    id: "content",
    title: "Content & Activity",
    items: [
      { id: "manage-posts", title: "Manage Posts", href: "/settings/manage-posts", icon: Library },
      { id: "collections", title: "Collections", href: "/collections", icon: FolderOpen },
      { id: "saved", title: "Saved Content", href: "/saved", icon: Bookmark },
      { id: "activity", title: "Activity Feed", href: "/activity", icon: Activity },
      { id: "data", title: "Data & Storage", href: "/settings/data", icon: Cloud },
    ],
  },
  {
    id: "appearance",
    title: "Appearance",
    items: [
      { id: "appearance", title: "Theme & Language", href: "/settings/appearance", icon: Palette, description: "Look, feel & data usage" },
    ],
  },
  {
    id: "support",
    title: "Support",
    items: [
      { id: "help", title: "Help Center", href: "/help", icon: HelpCircle },
      { id: "contact-support", title: "Contact Support", href: "/settings/contact-support", icon: PhoneCall },
      { id: "terms", title: "Terms of Service", href: "/settings/terms", icon: FileText },
      { id: "about", title: "About", href: "/settings/about", icon: Info },
    ],
  },
];

export function isSettingsNavActive(pathname: string, href: string): boolean {
  if (href.includes("#")) {
    const base = href.split("#")[0];
    return pathname === base;
  }
  if (href.startsWith("/settings")) {
    return pathname === href || (href !== "/settings" && pathname.startsWith(href));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
