"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, LogOut, Mail, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount, exportUserData, resendVerificationEmail } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { useAuth } from "@/context/auth-context";
import type { User } from "@/types/user";

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
    <section className="px-6 py-6 md:px-8 md:py-7">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Account actions</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Security, data export, and sign out.</p>
      </div>

      <div className="divide-y divide-border/60 rounded-2xl border border-border/60">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Email verification</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {user.isVerified === false ? (
                <p className="mt-1 text-sm font-medium text-destructive">Email not verified</p>
              ) : user.isVerified ? (
                <p className="mt-1 text-sm font-medium text-emerald-600">Verified</p>
              ) : null}
            </div>
          </div>
          {user.isVerified === false ? (
            <Button type="button" variant="outline" className="shrink-0 rounded-xl" disabled={resending} onClick={() => void handleResendVerification()}>
              {resending ? "Sending…" : "Resend verification"}
            </Button>
          ) : null}
        </div>

        <Link
          href="/auth/forgot?from=settings"
          className="flex items-center justify-between p-4 transition-colors hover:bg-muted/40"
        >
          <span className="inline-flex items-center gap-3 font-medium text-foreground">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            Change password
          </span>
          <span className="text-sm text-muted-foreground">→</span>
        </Link>

        <button
          type="button"
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
          disabled={exporting}
          onClick={() => void handleExportData()}
        >
          <span className="inline-flex items-center gap-3 font-medium text-foreground">
            <Download className="h-5 w-5 text-muted-foreground" />
            {exporting ? "Exporting…" : "Export my data"}
          </span>
        </button>

        <button
          type="button"
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/40"
          onClick={() => void signOut()}
        >
          <span className="inline-flex items-center gap-3 font-medium text-foreground">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            Sign out
          </span>
        </button>

        <div className="p-4">
          {!showDelete ? (
            <button
              type="button"
              className="inline-flex items-center gap-3 font-medium text-destructive hover:underline"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-5 w-5" />
              Delete account
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
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
                  className="rounded-xl"
                  disabled={deleting || !deletePassword.trim()}
                  onClick={() => void handleDeleteAccount()}
                >
                  {deleting ? "Deleting…" : "Delete forever"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
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
        </div>
      </div>
    </section>
  );
}
