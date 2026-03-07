"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, Monitor, RefreshCw, LogOut } from "lucide-react";
import {
  getAccountActivity,
  getActiveSessions,
  logoutFromSession,
} from "../../../../lib/api";
import type { AccountActivity as AccountActivityType, ActiveSession } from "../../../../types/user";
import { toast } from "sonner";

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

export default function AccountActivitySettingsPage() {
  const [activeTab, setActiveTab] = useState<"activity" | "sessions">("activity");
  const [activities, setActivities] = useState<AccountActivityType[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [activityRes, sessionsRes] = await Promise.all([
        getAccountActivity(),
        getActiveSessions(),
      ]);
      setActivities(activityRes.activities ?? []);
      setSessions(sessionsRes.sessions ?? []);
    } catch {
      toast.error("Failed to load account activity");
      setActivities([]);
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleLogoutSession = async (sessionId: string) => {
    setLoggingOutId(sessionId);
    try {
      await logoutFromSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      toast.success("Session ended");
    } catch {
      toast.error("Failed to end session");
    } finally {
      setLoggingOutId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
              Account activity
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Recent sign-ins and active sessions. End a session to sign out that device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-6 flex gap-2 border-b border-slate-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "activity"
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Activity className="h-4 w-4" />
            Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sessions")}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "sessions"
                ? "border-primary text-primary"
                : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Monitor className="h-4 w-4" />
            Active sessions
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : activeTab === "activity" ? (
          activities.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 dark:border-zinc-700">
              <Activity className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">No activity yet</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {activities.map((a, i) => (
                <li
                  key={`${a.timestamp}-${i}`}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/50"
                >
                  <p className="font-medium text-slate-900 dark:text-white">{a.description || a.type}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(a.timestamp)}
                    {a.device && ` · ${a.device}`}
                    {a.ipAddress && ` · ${a.ipAddress}`}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : sessions.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 dark:border-zinc-700">
            <Monitor className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">No other sessions</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {sessions.map((s) => {
              const isLoggingOut = loggingOutId === s.sessionId;
              return (
                <li
                  key={s.sessionId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{s.device}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {s.ipAddress}
                      {s.location && ` · ${s.location}`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Last active: {formatDate(s.lastActive)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLogoutSession(s.sessionId)}
                    disabled={isLoggingOut}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" />
                    {isLoggingOut ? "…" : "End session"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
