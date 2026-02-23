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
import { authForgotPassword } from "@/lib/api";

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
      toast.error(e instanceof Error ? e.message : "Failed to request reset");
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We&apos;ll email you a reset token.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Email</label>
              <Input {...form.register("email")} placeholder="you@example.com" autoComplete="email" />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Sending…" : "Send reset token"}
            </Button>
            <Link href="/auth/login" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
              Back to login
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
