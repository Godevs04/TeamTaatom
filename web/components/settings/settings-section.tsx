"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SettingsSectionProps = {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function SettingsSection({ id, title, description, children, className }: SettingsSectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-28 space-y-4", className)}>
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
