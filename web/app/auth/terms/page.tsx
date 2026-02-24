import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthTermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link
        href="/auth/register"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Create account
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          Terms &amp; Conditions
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          By using Taatom you agree to our user agreement and content policy. No objectionable,
          abusive, sexual, violent, hateful, or illegal content is allowed. Violations may result
          in suspension.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          For the full terms and contact information, see{" "}
          <Link href="/settings/terms" className="font-semibold text-primary hover:underline">
            Terms &amp; Conditions
          </Link>{" "}
          after signing in, or contact support.
        </p>
      </div>
    </div>
  );
}
