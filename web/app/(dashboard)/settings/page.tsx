"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, RefreshCw, User2 } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { useSettings } from "../../../hooks/useSettings";
import { toast } from "sonner";

const APP_VERSION = "1.0.0";

export default function SettingsPage() {
  const { user } = useAuth();
  const { resetAllSettings, isResetting } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const easeOut = [0.22, 1, 0.36, 1] as const;

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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
        className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-8 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70 md:p-10"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Settings
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Manage your account and preferences.
            </p>
          </div>
        </div>

        {user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: easeOut }}
            className="relative mt-6 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-800/50"
          >
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
          </motion.div>
        )}

        <p className="relative mt-6 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
          Use the menu on the left to open Account, Privacy & Security, Notifications, Appearance, Data & Storage,
          Collections, Activity Feed, Manage Posts, Follow Requests, Account Activity, Blocked Users, and more.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut, delay: 0.06 }}
        className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Reset</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Reset all settings to their default values. This cannot be undone.
            </p>
          </div>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleResetClick}
          disabled={isResetting}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            confirmReset
              ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700"
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
          {confirmReset ? (isResetting ? "Resetting…" : "Click again to confirm") : "Reset All Settings"}
        </motion.button>

        {confirmReset && !isResetting && (
          <motion.button
            type="button"
            whileHover={{ x: 2 }}
            onClick={() => setConfirmReset(false)}
            className="mt-3 w-full rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </motion.button>
        )}
      </motion.div>

      <div className="flex justify-center py-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">Taatom v{APP_VERSION}</p>
      </div>
    </div>
  );
}
