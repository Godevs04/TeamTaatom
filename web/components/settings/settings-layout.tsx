"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SettingsSidebar, SettingsMobileNav } from "./settings-sidebar";

type SettingsLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

export function SettingsLayout({ children, className }: SettingsLayoutProps) {
  return (
    <div className="relative mx-auto w-full max-w-[1100px]">
      <div
        className="pointer-events-none absolute inset-x-0 -top-6 -bottom-8 overflow-hidden opacity-80"
        aria-hidden
      >
        <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-primary/[0.05] blur-3xl" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-violet-500/[0.04] blur-3xl" />
      </div>

      <div className={cn("relative grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10", className)}>
        <SettingsSidebar />
        <div className="min-w-0 space-y-6">
          <SettingsMobileNav />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
