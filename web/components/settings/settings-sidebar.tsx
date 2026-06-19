"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { SETTINGS_NAV_GROUPS, isSettingsNavActive } from "./settings-nav-config";

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-6">
      {SETTINGS_NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isSettingsNavActive(pathname, item.href);
              const href = item.href.split("#")[0];
              return (
                <li key={item.id}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors duration-200",
                      active
                        ? "text-on-primary"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="settings-nav-active"
                        className="absolute inset-0 -z-10 rounded-xl bg-primary shadow-sm"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <Icon className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function SettingsSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();

  return (
    <aside className={cn("hidden lg:block", className)}>
      <div className="sticky top-24 space-y-5">
        <div className="px-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Settings</h2>
          {user ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {user.fullName ?? user.username ?? "Your account"}
            </p>
          ) : null}
        </div>
        <nav aria-label="Settings navigation">
          <NavLinks pathname={pathname} />
        </nav>
      </div>
    </aside>
  );
}

export function SettingsMobileNav() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-full items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          aria-expanded={open}
          aria-controls="settings-mobile-sheet"
        >
          <span className="inline-flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Browse settings
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close settings menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              id="settings-mobile-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Settings navigation"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-2xl bg-background shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Settings</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-3 py-4 pb-8">
                <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
