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
import { useAuth } from "../../../context/auth-context";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(6, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginClient({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter();
  const next = nextUrl || "/feed";
  const { signIn } = useAuth();

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
      toast.error(e instanceof Error ? e.message : "Failed to sign in");
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
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

