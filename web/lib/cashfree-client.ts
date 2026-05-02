/**
 * Cashfree **subscription** checkout must use the JS SDK (`subscriptionsCheckout`).
 * Opening `/pg/view/sessions/{id}` is for **order** `payment_session_id` only — subscription
 * IDs (`sub_session_...`) will return request_failed.
 */

const CASHFREE_V3_SCRIPT = "https://sdk.cashfree.com/js/v3/cashfree.js";

type SubsCheckoutResult = { error?: { message?: string } };

type CashfreeInstance = {
  subscriptionsCheckout: (opts: {
    subsSessionId: string;
    redirectTarget: string;
  }) => Promise<SubsCheckoutResult>;
};

type CashfreeFactory = (config: { mode: "sandbox" | "production" }) => CashfreeInstance;

function getCashfreeMode(): "sandbox" | "production" {
  const env = process.env.NEXT_PUBLIC_CASHFREE_ENV?.toLowerCase();
  if (env === "production") return "production";
  if (env === "sandbox") return "sandbox";
  const prod =
    process.env.NEXT_PUBLIC_APP_ENV === "production" || process.env.NODE_ENV === "production";
  return prod ? "production" : "sandbox";
}

let cashfreeScriptLoad: Promise<void> | null = null;

function loadCashfreeScript(): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Subscription checkout is only available in the browser"));
  }
  if ((window as unknown as { Cashfree?: CashfreeFactory }).Cashfree) {
    return Promise.resolve();
  }
  if (cashfreeScriptLoad) return cashfreeScriptLoad;

  cashfreeScriptLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CASHFREE_V3_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Cashfree SDK")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.src = CASHFREE_V3_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.body.appendChild(s);
  });

  return cashfreeScriptLoad;
}

/**
 * Opens Cashfree hosted subscription mandate/checkout for a `subscription_session_id`
 * from POST /connect/subscribe (`paymentSessionId` in our API).
 */
export async function openCashfreeSubscriptionCheckout(subsSessionId: string): Promise<void> {
  const id = subsSessionId?.trim();
  if (!id) throw new Error("Missing subscription session");

  await loadCashfreeScript();

  const Cashfree = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
  if (typeof Cashfree !== "function") {
    throw new Error("Cashfree SDK did not load");
  }

  const cashfree = Cashfree({ mode: getCashfreeMode() });
  const result = await cashfree.subscriptionsCheckout({
    subsSessionId: id,
    redirectTarget: "_self",
  });

  if (result?.error?.message) {
    throw new Error(result.error.message);
  }
}
