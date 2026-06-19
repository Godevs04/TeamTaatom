"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DangerZoneCardProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function DangerZoneCard({
  title = "Danger zone",
  description = "Irreversible actions for your account.",
  children,
  className,
}: DangerZoneCardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-4 shadow-sm sm:p-6",
        className
      )}
    >
      <header className="mb-4">
        <h3 className="text-base font-medium text-destructive">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <div className="divide-y divide-destructive/10 rounded-xl bg-background/60">{children}</div>
    </article>
  );
}
