"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authSignUp } from "@/lib/api";

const schema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  username: z.string().min(3, "Username is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Minimum 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", username: "", email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await authSignUp(values);
      toast.success("OTP sent. Verify your account to continue.");
      router.replace(`/auth/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to sign up");
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Join Taatom and start sharing trips.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Full name</label>
              <Input {...form.register("fullName")} placeholder="Jane Doe" />
              {form.formState.errors.fullName && (
                <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Username</label>
              <Input {...form.register("username")} placeholder="janedoe" />
              {form.formState.errors.username && (
                <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Email</label>
              <Input {...form.register("email")} placeholder="you@example.com" autoComplete="email" />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Password</label>
              <Input {...form.register("password")} type="password" autoComplete="new-password" />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create account"}
            </Button>

            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-semibold text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
