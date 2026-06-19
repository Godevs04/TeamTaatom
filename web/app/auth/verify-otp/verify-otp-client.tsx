"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OtpInput } from "@/components/auth/otp-input";
import { authResendOtp, authVerifyOtp } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { getFriendlyAuthErrorMessage } from "@/lib/auth-errors";

const RESEND_COOLDOWN_SEC = 60;

const schema = z.object({
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});
type FormValues = z.infer<typeof schema>;

export default function VerifyOtpClient({ email: emailProp }: { email?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = emailProp ?? searchParams.get("email") ?? undefined;
  const [resendLoading, setResendLoading] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { otp: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      if (!email) throw new Error("Missing email");
      await authVerifyOtp({ email, otp: values.otp });

      toast.success("Account verified. Please sign in.");

      const runOnboarding =
        typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEYS.webOnboardingAfterVerify) === "1";
      if (runOnboarding) {
        sessionStorage.removeItem(STORAGE_KEYS.webOnboardingAfterVerify);
      }

      const next = runOnboarding ? encodeURIComponent("/onboarding/welcome") : encodeURIComponent("/feed");
      const loginQs = `email=${encodeURIComponent(email)}&next=${next}`;
      router.replace(`/auth/login?${loginQs}`);
    } catch (e: unknown) {
      toast.error(getFriendlyAuthErrorMessage(e));
    }
  };

  const resend = async () => {
    if (countdown > 0 || resendLoading) return;
    try {
      if (!email) throw new Error("Missing email");
      setResendLoading(true);
      await authResendOtp({ email });
      setCountdown(RESEND_COOLDOWN_SEC);
      toast.success("A new OTP has been sent. Check your inbox and spam folder.");
    } catch (e: unknown) {
      toast.error(getFriendlyAuthErrorMessage(e));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Verify OTP</CardTitle>
          <CardDescription>Enter the 6-digit code sent to {email || "your email"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <Controller
              control={form.control}
              name="otp"
              render={({ field }) => (
                <OtpInput
                  value={field.value}
                  onChange={field.onChange}
                  error={form.formState.errors.otp?.message}
                  disabled={form.formState.isSubmitting}
                />
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting || !email || form.watch("otp").length !== 6}>
              {form.formState.isSubmitting ? "Verifying…" : "Verify"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => void resend()}
                disabled={resendLoading || countdown > 0 || !email}
                className="font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {resendLoading
                  ? "Sending…"
                  : countdown > 0
                    ? `Resend in ${countdown}s`
                    : "Resend OTP"}
              </button>
              <Link href="/auth/login" className="font-semibold hover:underline">
                Back to login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
