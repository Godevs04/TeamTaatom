"use client";

import * as React from "react";
import { AlertTriangle, Info, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./button";

export type ConfirmVariant = "destructive" | "warning" | "default";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />;
      case "warning":
        return <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
      default:
        return <Info className="h-6 w-6 text-primary" />;
    }
  };

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case "destructive":
        return "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700";
      case "warning":
        return "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700";
      default:
        return "bg-primary text-on-primary hover:bg-primary-hover";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? "confirm-dialog-description" : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={isLoading ? undefined : onCancel}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md scale-100 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              variant === "destructive"
                ? "bg-red-50 dark:bg-red-950/50"
                : variant === "warning"
                ? "bg-amber-50 dark:bg-amber-950/50"
                : "bg-slate-100 dark:bg-zinc-800"
            }`}
          >
            {getIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="confirm-dialog-title"
              className="text-base font-semibold text-slate-900 dark:text-zinc-50"
            >
              {title}
            </h3>
            {description && (
              <p
                id="confirm-dialog-description"
                className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400"
              >
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl border-slate-200 dark:border-zinc-700"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-xl ${getConfirmButtonClasses()}`}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
