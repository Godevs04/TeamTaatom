"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { getFriendlyAuthErrorMessage } from "@/lib/auth-errors";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(6, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginClient({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const next = nextUrl || "/feed";
  const { user, isLoading: authLoading, signIn } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      router.replace(next);
    }
  }, [user, authLoading, next, router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await signIn(values);
      toast.success("Welcome back");
      router.replace(next);
    } catch (e: unknown) {
      toast.error(getFriendlyAuthErrorMessage(e));
    }
  };

  if (authLoading) {
    return (
      <div className="landing-bg flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return null;

  return (
    <AuthPageShell
      cardEyebrow="Welcome back"
      cardTitle="Sign in to Taatom"
      cardSubtitle="Pick up where you left off on web."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700">Email or username</label>
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
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700">Password</label>
          <Input
            {...form.register("password")}
            type="password"
            autoComplete="current-password"
            className="h-12 rounded-xl border-slate-200/90 bg-slate-50/80"
          />
          {form.formState.errors.password && (
            <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <Link href="/auth/forgot" className="font-medium text-slate-500 hover:text-primary">
            Forgot password?
          </Link>
        </div>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.2 }}>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-95"
          >
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </motion.div>
        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-semibold text-primary hover:underline">
            Create account
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
