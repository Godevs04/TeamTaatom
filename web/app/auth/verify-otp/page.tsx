import { Suspense } from "react";
import VerifyOtpClient from "./verify-otp-client";

function VerifyOtpFallback() {
  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<VerifyOtpFallback />}>
      <VerifyOtpClient />
    </Suspense>
  );
}
