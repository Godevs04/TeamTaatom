import Link from "next/link";
import { cn } from "@/lib/utils";

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/copyrights", label: "Copyright Consent" },
  { href: "/child-safety", label: "Child Safety" },
  { href: "/contact", label: "Contact Us" },
] as const;

type SiteFooterProps = {
  variant?: "default" | "landing";
};

export function SiteFooter({ variant = "default" }: SiteFooterProps) {
  const isLanding = variant === "landing";

  return (
    <footer
      className={cn(
        "border-t py-6 sm:py-8",
        isLanding
          ? "landing-page-footer relative z-10 border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-muted)]"
          : "site-footer-root border-slate-200/70 bg-white text-slate-500 dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:text-zinc-400"
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-col items-center gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-6",
          isLanding ? "max-w-7xl lg:px-8" : "max-w-6xl"
        )}
      >
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-[13px] leading-none sm:justify-start">
          {FOOTER_LINKS.map((link, i) => (
            <span key={link.href} className="inline-flex items-center">
              {i > 0 ? (
                <span
                  className={cn(
                    "mx-2 opacity-50",
                    isLanding ? "text-[var(--landing-subtle)]" : "text-slate-400 dark:text-zinc-600"
                  )}
                  aria-hidden
                >
                  ·
                </span>
              ) : null}
              <Link
                href={link.href}
                className={cn(
                  "transition-colors",
                  isLanding
                    ? "hover:text-[var(--landing-ink)]"
                    : "hover:text-slate-900 hover:underline dark:hover:text-zinc-100"
                )}
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
        <p
          className={cn(
            "shrink-0 text-center text-[13px] leading-none sm:text-right",
            isLanding ? "text-[var(--landing-muted)]" : ""
          )}
        >
          © {new Date().getFullYear()} Taatom. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
