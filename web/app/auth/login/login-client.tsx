"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { getFriendlyAuthErrorMessage } from "@/lib/auth-errors";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(6, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginClient({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const next = nextUrl || "/feed";
  const { user, isLoading: authLoading, signIn } = useAuth();

  // If already logged in, redirect to feed (or intended destination) — backup to middleware
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

  const lottieEmbedUrl = "https://lottie.host/embed/de6e7dfe-658a-422c-9dbd-06d959550e52/Oh0ZqzklZE.lottie";

  if (user) return null;

  return (
    <div className="mx-auto grid w-full max-w-md gap-4 px-3 py-8 sm:gap-6 sm:px-4 sm:py-10">
      <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
        <iframe
          title="Login animation"
          src={lottieEmbedUrl}
          className="h-44 w-full border-0 sm:h-52"
          allowFullScreen
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your Taatom account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Email or username</label>
              <Input {...form.register("email")} placeholder="you@example.com" autoComplete="email" />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Password</label>
              <Input {...form.register("password")} type="password" autoComplete="current-password" />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <Link href="/auth/forgot" className="font-semibold text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
              <Link href="/auth/register" className="font-semibold hover:underline">
                Create account
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
