"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SettingsCardProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export function SettingsCard({ title, description, children, className, id }: SettingsCardProps) {
  return (
    <article
      id={id}
      className={cn(
        "rounded-2xl bg-card/80 p-4 shadow-sm ring-1 ring-border/40 backdrop-blur-sm transition-shadow duration-200",
        "hover:shadow-md sm:p-6",
        className
      )}
    >
      {(title || description) && (
        <header className="mb-4 sm:mb-5">
          {title ? <h3 className="text-base font-medium text-foreground">{title}</h3> : null}
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </header>
      )}
      {children}
    </article>
  );
}
