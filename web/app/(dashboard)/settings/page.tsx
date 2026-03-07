"use client";

import { useState } from "react";
import { Settings, RefreshCw, User2 } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { useSettings } from "../../../hooks/useSettings";
import { toast } from "sonner";

const APP_VERSION = "1.0.0";

export default function SettingsPage() {
  const { user } = useAuth();
  const { resetAllSettings, isResetting } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    resetAllSettings()
      .then(() => {
        toast.success("Settings have been reset to default");
        setConfirmReset(false);
      })
      .catch(() => {
        toast.error("Failed to reset settings");
      });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">Settings</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Manage your account and preferences.</p>
          </div>
        </div>

        {user && (
          <div className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                {user.profilePic ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.profilePic}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User2 className="h-6 w-6 text-slate-400" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{user.fullName ?? "User"}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
          Use the menu on the left to open Account, Privacy & Security, Notifications, Appearance, Data & Storage,
          Collections, Activity Feed, Manage Posts, Follow Requests, Account Activity, Blocked Users, and more.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/95">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reset</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Reset all settings to their default values. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={handleResetClick}
          disabled={isResetting}
          className={`mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            confirmReset
              ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700"
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
          {confirmReset ? (isResetting ? "Resetting…" : "Click again to confirm") : "Reset All Settings"}
        </button>
        {confirmReset && !isResetting && (
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="ml-3 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="flex justify-center py-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">Taatom v{APP_VERSION}</p>
      </div>
    </div>
  );
}
