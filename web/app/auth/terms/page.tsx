import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Terms summary",
  description: "Summary of Taatom terms for account creation. Read the full Terms of Service for complete details.",
  path: "/auth/terms",
  noIndex: true,
});

export default function AuthTermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link
        href="/auth/register"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Create account
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl dark:text-zinc-50">
          Terms &amp; Conditions
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          By creating a Taatom account you agree to our Terms of Service and Community Guidelines.
          Objectionable, abusive, sexual, violent, hateful, infringing, or illegal content is not
          allowed. Violations may result in content removal or account suspension.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-zinc-400">
          <li>
            Full legal terms:{" "}
            <Link href="/terms" className="font-semibold text-primary hover:underline">
              Terms of Service
            </Link>
          </li>
          <li>
            Community rules:{" "}
            <Link href="/community-guidelines" className="font-semibold text-primary hover:underline">
              Community Guidelines
            </Link>
          </li>
          <li>
            Privacy:{" "}
            <Link href="/privacy" className="font-semibold text-primary hover:underline">
              Privacy Policy
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
