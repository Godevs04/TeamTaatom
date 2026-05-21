"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { openCashfreeSubscriptionCheckout } from "@/lib/cashfree-client";

function CheckoutInner() {
  const searchParams = useSearchParams();
  const subsSessionId = searchParams.get("subsSessionId") || "";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subsSessionId.trim()) {
      setError("Missing subscription session. Close this page and try again from the app.");
      return;
    }
    openCashfreeSubscriptionCheckout(subsSessionId).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "Could not open payment";
      setError(msg);
    });
  }, [subsSessionId]);

  if (error) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Payment could not start</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <p className="text-muted-foreground">Opening secure payment…</p>
    </main>
  );
}

export default function ConnectCashfreeCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-center text-muted-foreground">Loading payment…</main>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
