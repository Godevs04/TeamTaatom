"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  HelpCircle,
  BookOpen,
  Shield,
  Flag,
  FileText,
  Lock,
  ChevronRight,
  Star,
  Share2,
  RefreshCw,
  Copy,
  ShieldAlert,
  PhoneCall,
} from "lucide-react";
import { useAuth } from "../../../../context/auth-context";
import { toast } from "sonner";

const APP_VERSION = "1.0.0";
const APP_ICON_URL = "https://res.cloudinary.com/dcvdqhqzc/image/upload/v1766525159/aefbv7kr261jzp4sptel.png";
const SUPPORT_EMAIL = "contact@taatom.com";
const WEBSITE_URL = "https://taatom.com";
const DOWNLOAD_URL = "https://taatom.com/download";

function formatMemberSince(dateStr?: string) {
  if (!dateStr) return "Unknown";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}

function formatLastLogin(dateStr?: string) {
  if (!dateStr) return "Never";
  try {
    const lastLoginDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - lastLoginDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return lastLoginDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Never";
  }
}

const policyLinks = [
  { title: "Privacy Policy", href: "/privacy", icon: Shield },
  { title: "Terms of Service", href: "/terms", icon: FileText },
  { title: "Copyright Consent", href: "/copyrights", icon: Lock },
  { title: "Child Safety", href: "/child-safety", icon: ShieldAlert },
  { title: "Community Guidelines", href: "/settings/content-policy", icon: Flag },
  { title: "Contact Us", href: "/contact", icon: PhoneCall },
];

export default function AboutSettingsPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyUserId = useCallback(() => {
    const value = user?.username ? `@${user.username}` : user?._id ?? "";
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        toast.success("User ID copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Failed to copy"));
  }, [user?.username, user?._id]);

  const handleShare = useCallback(() => {
    const text = `Check out Taatom - Share your moments with the world!\n\nDownload now: ${DOWNLOAD_URL}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: "Share Taatom",
          text,
          url: DOWNLOAD_URL,
        })
        .then(() => toast.success("Thank you for sharing Taatom!"))
        .catch((err) => {
          if (err.name !== "AbortError") toast.error("Failed to share");
        });
    } else {
      navigator.clipboard.writeText(text).then(() => toast.success("Link copied to clipboard"));
    }
  }, []);

  const handleCheckUpdates = useCallback(() => {
    toast.success(`You are using the latest version. Version: ${APP_VERSION}`, {
      description: "Check for Updates",
    });
  }, []);

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>

      {/* App Info */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-slate-200/80 bg-white dark:border-zinc-700 dark:bg-zinc-800">
            <Image
              src={APP_ICON_URL}
              alt="Taatom"
              width={80}
              height={80}
              className="object-contain p-2"
              unoptimized
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Taatom</h1>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">Version {APP_VERSION}</p>
          <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
            Share your moments with the world
          </p>
        </div>
      </div>

      {/* Account Information */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account Information</h2>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 py-3 dark:border-zinc-700/80">
            <span className="text-sm text-slate-500 dark:text-slate-400">User ID</span>
            <button
              type="button"
              onClick={copyUserId}
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              {user?.username ? `@${user.username}` : user?._id ? `${user._id.substring(0, 8)}...` : "—"}
              {copied ? (
                <span className="text-xs text-green-600 dark:text-green-400">Copied</span>
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 py-3 dark:border-zinc-700/80">
            <span className="text-sm text-slate-500 dark:text-slate-400">Member Since</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {formatMemberSince((user as { createdAt?: string })?.createdAt)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Last Login</span>
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {formatLastLogin((user as { lastLogin?: string })?.lastLogin)}
            </span>
          </div>
        </div>
      </div>

      {/* Support */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Support</h2>
        <div className="mt-4 space-y-0">
          <Link
            href="/settings/contact-support"
            className="flex items-center justify-between py-3 text-primary hover:underline"
          >
            <span className="inline-flex items-center gap-3">
              <HelpCircle className="h-5 w-5" />
              Contact Support
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Link>
          <Link
            href="/contact"
            className="flex items-center justify-between py-3 text-primary hover:underline"
          >
            <span className="inline-flex items-center gap-3">
              <BookOpen className="h-5 w-5" />
              Contact Us (Web)
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Legal & Policies */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Legal & Policies</h2>
        <div className="mt-4 space-y-0">
          {policyLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.title}
                href={link.href}
                className="flex items-center justify-between py-3 text-primary hover:underline"
              >
                <span className="inline-flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  {link.title}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* App Actions */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">App Actions</h2>
        <div className="mt-4 space-y-0">
          <button
            type="button"
            onClick={() => toast.info("Rate Taatom on the App Store or Play Store when you use the mobile app.")}
            className="flex w-full items-center justify-between py-3 text-left text-primary hover:underline"
          >
            <span className="inline-flex items-center gap-3">
              <Star className="h-5 w-5" />
              Rate Taatom
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex w-full items-center justify-between py-3 text-left text-primary hover:underline"
          >
            <span className="inline-flex items-center gap-3">
              <Share2 className="h-5 w-5" />
              Share Taatom
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={handleCheckUpdates}
            className="flex w-full items-center justify-between py-3 text-left text-primary hover:underline"
          >
            <span className="inline-flex items-center gap-3">
              <RefreshCw className="h-5 w-5" />
              Check for Updates
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Legal */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Legal</h2>
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200/80 py-3 dark:border-zinc-700/80">
            <span className="text-sm text-slate-500 dark:text-slate-400">Copyright</span>
            <span className="text-sm text-slate-900 dark:text-white">© 2026 Taatom Inc.</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200/80 py-3 dark:border-zinc-700/80">
            <span className="text-sm text-slate-500 dark:text-slate-400">Support Email</span>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-sm text-slate-900 dark:text-white hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <div className="flex flex-wrap justify-between gap-2 py-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Website</span>
            <a
              href={WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-900 dark:text-white hover:underline"
            >
              {WEBSITE_URL}
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Made with ❤️ by Taatom</p>
      </div>
    </div>
  );
}
