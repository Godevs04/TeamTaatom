"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { authResendOtp, authVerifyOtp } from "../../../lib/api";
import { STORAGE_KEYS } from "../../../lib/constants";

const schema = z.object({
  otp: z.string().min(4, "OTP is required"),
});
type FormValues = z.infer<typeof schema>;

export default function VerifyOtpClient({ email }: { email?: string }) {
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { otp: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      if (!email) throw new Error("Missing email");
      const res = await authVerifyOtp({ email, otp: values.otp });
      if (res?.token && typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEYS.webFallbackToken, res.token);
      }
      toast.success("Account verified");
      router.replace("/feed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Invalid OTP");
    }
  };

  const resend = async () => {
    try {
      if (!email) throw new Error("Missing email");
      await authResendOtp({ email });
      toast.success("OTP resent");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to resend OTP");
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Verify OTP</CardTitle>
          <CardDescription>Enter the OTP sent to {email || "your email"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">OTP</label>
              <Input {...form.register("otp")} inputMode="numeric" placeholder="123456" />
              {form.formState.errors.otp && (
                <p className="text-xs text-destructive">{form.formState.errors.otp.message}</p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting || !email}>
              {form.formState.isSubmitting ? "Verifying…" : "Verify"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={resend} className="font-semibold text-muted-foreground hover:text-foreground">
                Resend OTP
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

