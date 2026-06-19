"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, LogOut, Mail, Download, Trash2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount, exportUserData, resendVerificationEmail } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { useAuth } from "@/context/auth-context";
import type { User } from "@/types/user";
import { SettingsCard } from "./settings-card";
import { SettingsAction } from "./settings-action";
import { DangerZoneCard } from "./danger-zone-card";
import { SettingsSection } from "./settings-section";

export function AccountSecuritySection({ user }: { user: User }) {
  const { signOut } = useAuth();
  const [resending, setResending] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);
  const [deletePassword, setDeletePassword] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const handleResendVerification = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success("Verification email sent! Please check your inbox.");
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const handleExportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportUserData();
      const jsonData = JSON.stringify(data, null, 2);
      const fileName = `taatom-data-export-${Date.now()}.json`;
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Your data export has started.");
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      toast.error("Please enter your password");
      return;
    }
    const confirmed = window.confirm(
      "Are you absolutely sure? This will permanently delete your account and all data. This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      toast.success("Your account has been deleted. You will be logged out.");
      setTimeout(() => {
        void signOut();
      }, 1500);
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <SettingsSection
      id="security"
      title="Account & Security"
      description="Protect your account, manage sessions, and control your data."
    >
      <SettingsCard title="Security" description="Email verification and password.">
        <div className="divide-y divide-border/50">
          <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Email verification</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.isVerified === false ? (
                  <p className="mt-1 text-sm font-medium text-destructive">Email not verified</p>
                ) : user.isVerified ? (
                  <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">Verified</p>
                ) : null}
              </div>
            </div>
            {user.isVerified === false ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl"
                disabled={resending}
                onClick={() => void handleResendVerification()}
              >
                {resending ? "Sending…" : "Resend verification"}
              </Button>
            ) : null}
          </div>
          <SettingsAction href="/auth/forgot?from=settings" icon={KeyRound} title="Change password" description="Update your login credentials" />
        </div>
      </SettingsCard>

      <SettingsCard title="Data" description="Download a copy of your Taatom data.">
        <SettingsAction
          icon={Download}
          title={exporting ? "Exporting…" : "Export my data"}
          description="Download a JSON archive of your account"
          onClick={() => void handleExportData()}
          loading={exporting}
          trailing={null}
        />
      </SettingsCard>

      <SettingsCard title="Sessions" description="Devices signed in to your account.">
        <SettingsAction
          href="/settings/account-activity?tab=sessions"
          icon={Monitor}
          title="Active devices"
          description="View and manage login sessions"
        />
        <SettingsAction
          href="/settings/account-activity"
          icon={Monitor}
          title="Login history"
          description="Recent account activity"
        />
      </SettingsCard>

      <DangerZoneCard>
        <SettingsAction
          icon={LogOut}
          title="Sign out"
          description="Sign out on this device"
          onClick={() => void signOut()}
          trailing={null}
        />
        {!showDelete ? (
          <SettingsAction
            icon={Trash2}
            title="Delete account"
            description="Permanently remove your account and data"
            onClick={() => setShowDelete(true)}
            destructive
            trailing={null}
          />
        ) : (
          <div className="space-y-3 p-3">
            <p className="text-sm font-medium text-destructive">This permanently deletes your account and all data.</p>
            <Input
              type="password"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              className="rounded-xl"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-xl"
                disabled={deleting || !deletePassword.trim()}
                onClick={() => void handleDeleteAccount()}
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl"
                disabled={deleting}
                onClick={() => {
                  setShowDelete(false);
                  setDeletePassword("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DangerZoneCard>
    </SettingsSection>
  );
}
