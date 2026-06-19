"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: React.ElementType;
  hint?: string;
};

type SettingsOptionGroupProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  variant?: "segmented" | "pills";
};

export function SettingsOptionGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
  variant = "segmented",
}: SettingsOptionGroupProps<T>) {
  if (variant === "segmented") {
    return (
      <div className="inline-flex rounded-xl bg-muted/60 p-1 dark:bg-muted/40">
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.hint}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
                selected
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.hint}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              selected
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
