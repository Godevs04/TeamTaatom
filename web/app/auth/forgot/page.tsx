"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { authForgotPassword } from "@/lib/api";
import { getFriendlyAuthErrorMessage } from "@/lib/auth-errors";

const schema = z.object({
  email: z.string().email("Valid email required"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await authForgotPassword({ email: values.email });
      toast.success("Reset token sent. Check your email.");
      router.replace(`/auth/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (e: unknown) {
      toast.error(getFriendlyAuthErrorMessage(e));
    }
  };

  return (
    <AuthPageShell
      cardEyebrow="Account recovery"
      cardTitle="Reset your password"
      cardSubtitle="We’ll email you a reset token so you can choose a new password."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700">Email</label>
          <Input
            {...form.register("email")}
            placeholder="you@example.com"
            autoComplete="email"
            className="h-12 rounded-xl border-slate-200/90 bg-slate-50/80"
          />
          {form.formState.errors.email && (
            <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
          )}
        </div>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.2 }}>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-95"
          >
            {form.formState.isSubmitting ? "Sending…" : "Send reset token"}
          </Button>
        </motion.div>
        <p className="text-center text-sm text-slate-500">
          <Link href="/auth/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
