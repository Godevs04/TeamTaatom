"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSettings } from "../../../../hooks/useSettings";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";

export default function NotificationsSettingsPage() {
  const { settings, isLoading, updateCategory, isUpdating } = useSettings();
  const updatingRef = useRef<Set<string>>(new Set());

  const handleUpdate = useCallback(
    async (key: string, value: boolean) => {
      if (updatingRef.current.has(key)) return;
      updatingRef.current.add(key);
      try {
        await updateCategory("notifications", { [key]: value });
        toast.success("Setting updated");
      } catch {
        toast.error("Failed to update setting");
      } finally {
        updatingRef.current.delete(key);
      }
    },
    [updateCategory]
  );

  const notifications = settings?.notifications ?? {};
  const pushNotifications = notifications.pushNotifications ?? true;
  const emailNotifications = notifications.emailNotifications ?? true;
  const likesNotifications = notifications.likesNotifications ?? true;
  const commentsNotifications = notifications.commentsNotifications ?? true;
  const followsNotifications = notifications.followsNotifications ?? true;
  const messagesNotifications = notifications.messagesNotifications ?? true;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <Skeleton className="h-96 w-full rounded-[1.75rem]" />
      </div>
    );
  }

  const Toggle = ({ label, description, checked, keyName }: { label: string; description: string; checked: boolean; keyName: string }) => (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/50">
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => handleUpdate(keyName, !checked)}
        disabled={isUpdating}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-slate-300 dark:bg-zinc-600"
        }`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70">
        <div className="border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-transparent px-5 py-6 md:px-8 md:py-7 dark:border-zinc-800/70 dark:from-zinc-800/40">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">Notifications</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Push, email, and activity alerts.</p>
        </div>
        <div className="space-y-4 px-5 py-6 md:px-8 md:py-7">
          <Toggle
            label="Push notifications"
            description="Receive push notifications"
            checked={pushNotifications}
            keyName="pushNotifications"
          />
          <Toggle
            label="Email notifications"
            description="Receive email alerts"
            checked={emailNotifications}
            keyName="emailNotifications"
          />
          <Toggle
            label="Likes"
            description="When someone likes your post"
            checked={likesNotifications}
            keyName="likesNotifications"
          />
          <Toggle
            label="Comments"
            description="When someone comments"
            checked={commentsNotifications}
            keyName="commentsNotifications"
          />
          <Toggle
            label="Follows"
            description="When someone follows you"
            checked={followsNotifications}
            keyName="followsNotifications"
          />
          <Toggle
            label="Messages"
            description="New direct messages"
            checked={messagesNotifications}
            keyName="messagesNotifications"
          />
        </div>
      </div>
    </div>
  );
}
