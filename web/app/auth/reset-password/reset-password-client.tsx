"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authResetPassword } from "@/lib/api";

const schema = z.object({
  token: z.string().min(4, "Reset token is required"),
  newPassword: z.string().min(8, "Minimum 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function ResetPasswordClient({ email: emailProp }: { email?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = emailProp ?? searchParams.get("email") ?? undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { token: "", newPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      if (!email) throw new Error("Missing email");
      await authResetPassword({ email, token: values.token, newPassword: values.newPassword });
      toast.success("Password updated. Please sign in.");
      router.replace("/auth/login");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reset password");
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Use the reset token sent to {email || "your email"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Reset token</label>
              <Input {...form.register("token")} placeholder="123456" />
              {form.formState.errors.token && (
                <p className="text-xs text-destructive">{form.formState.errors.token.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">New password</label>
              <Input {...form.register("newPassword")} type="password" autoComplete="new-password" />
              {form.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={form.formState.isSubmitting || !email}>
              {form.formState.isSubmitting ? "Updating…" : "Update password"}
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
