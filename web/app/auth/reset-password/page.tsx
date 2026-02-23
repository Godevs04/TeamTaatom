import { Suspense } from "react";
import ResetPasswordClient from "./reset-password-client";

function ResetPasswordFallback() {
  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
