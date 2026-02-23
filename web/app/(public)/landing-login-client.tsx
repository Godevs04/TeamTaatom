"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/auth-context";
import { MapPin, Sparkles } from "lucide-react";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(6, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export function LandingLoginClient({ nextUrl = "/feed" }: { nextUrl?: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading, signIn } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  React.useEffect(() => {
    if (authLoading) return;
    if (user?._id) {
      router.replace(nextUrl || "/feed");
    }
  }, [user, authLoading, router, nextUrl]);

  const onSubmit = async (values: FormValues) => {
    try {
      await signIn(values);
      toast.success("Welcome back");
      router.replace(nextUrl || "/feed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to sign in");
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user?._id) return null;

  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-2xl shadow-slate-200/50">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative grid min-h-[calc(100vh-5rem)] gap-12 px-6 py-12 md:grid-cols-2 md:items-center md:gap-16 md:px-14 md:py-16 lg:px-20">
        {/* Left: Lottie animation + branding & copy */}
        <div className="flex flex-col justify-center space-y-6">
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-white/60 shadow-sm">
            <iframe
              title="Login animation"
              src="https://lottie.host/embed/de6e7dfe-658a-422c-9dbd-06d959550e52/Oh0ZqzklZE.lottie"
              className="h-56 w-full border-0 md:h-64"
              allowFullScreen
            />
          </div>
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/90 px-4 py-2 shadow-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Premium travel social</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-[2.75rem]">
              Travel stories that feel alive.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-slate-600">
              Discover trips, locations, and creators. Share posts with photos, location, and music — like Instagram meets
              Airbnb for travelers.
            </p>
            <div className="flex items-center gap-2 text-slate-500">
              <MapPin className="h-5 w-5" />
              <span className="text-sm">Sign in to explore the feed and create your first trip.</span>
            </div>
          </div>
        </div>

        {/* Right: Login card */}
        <div className="flex items-center justify-center md:justify-end">
          <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-8 shadow-xl shadow-slate-200/50 backdrop-blur">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to continue to Taatom</p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-5">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <Input
                  {...form.register("email")}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50"
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
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50"
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
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-12 rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-95"
              >
                {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <Link href="/auth/register" className="font-semibold text-primary hover:underline">
                  Create account
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
