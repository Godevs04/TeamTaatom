"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsActionBase = {
  icon?: React.ElementType;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  className?: string;
  destructive?: boolean;
  loading?: boolean;
  disabled?: boolean;
};

type SettingsActionLink = SettingsActionBase & {
  href: string;
  onClick?: never;
};

type SettingsActionButton = SettingsActionBase & {
  href?: never;
  onClick: () => void;
};

export type SettingsActionProps = SettingsActionLink | SettingsActionButton;

const actionClassName = (destructive?: boolean) =>
  cn(
    "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-200",
    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    destructive && "hover:bg-destructive/5"
  );

export function SettingsAction(props: SettingsActionProps) {
  const { icon: Icon, title, description, trailing, className, destructive, loading, disabled } = props;
  const content = (
    <>
      {Icon ? (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground transition-colors group-hover:bg-muted",
            destructive && "text-destructive"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium text-foreground", destructive && "text-destructive")}>
          {title}
        </span>
        {description ? <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span> : null}
      </span>
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
      )}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={cn(actionClassName(destructive), className)}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled || loading}
      className={cn(actionClassName(destructive), "disabled:opacity-50", className)}
    >
      {content}
    </button>
  );
}
