"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MapPlacesShellProps = {
  className?: string;
  roundedClassName?: string;
  loading?: boolean;
  empty?: boolean;
  children?: ReactNode;
};

export function MapPlacesShell({
  className,
  roundedClassName = "rounded-2xl",
  loading,
  empty,
  children,
}: MapPlacesShellProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-[#e8ebe8] dark:bg-zinc-800/60",
          roundedClassName,
          className
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-[#e8ebe8] px-4 text-center text-xs text-slate-500 dark:bg-zinc-800/60 dark:text-zinc-400",
          roundedClassName,
          className
        )}
      >
        Map preview unavailable
      </div>
    );
  }

  return <>{children}</>;
}
