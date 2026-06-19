"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SettingsPageHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function SettingsPageHeader({ title, description, className }: SettingsPageHeaderProps) {
  return (
    <header className={cn("space-y-1 pb-2", className)}>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}
