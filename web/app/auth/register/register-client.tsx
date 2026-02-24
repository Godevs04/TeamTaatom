"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authSignUp, checkUsernameAvailability } from "@/lib/api";
import { X } from "lucide-react";

const TERMS_FULL_URL = "https://www.taatom.com/terms";

const LOTTIE_EMBED_URL = "https://lottie.host/embed/de6e7dfe-658a-422c-9dbd-06d959550e52/Oh0ZqzklZE.lottie";

function TermsPopup({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id="terms-title" className="text-lg font-semibold text-slate-900">
            Terms of Service
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 max-h-[calc(85vh-4.5rem)] text-sm text-slate-600 space-y-4">
          <p>
            By using Taatom you agree to these Terms. If you disagree, you may not use the App.
          </p>
          <div>
            <h3 className="font-semibold text-slate-900">Account</h3>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>You must be at least 12 years old</li>
              <li>Provide accurate information; one account per person</li>
              <li>You are responsible for all activity and account security</li>
              <li>We may suspend or terminate accounts that violate these Terms</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Content guidelines</h3>
            <p className="mt-1">You agree not to post content that:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Violates laws or others&apos; rights</li>
              <li>Contains hate speech, harassment, threats, or is pornographic/violent</li>
              <li>Promotes illegal activities, spam, or misleading information</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Prohibited activities</h3>
            <p className="mt-1">No illegal use, unauthorized access, impersonation, or automated scraping.</p>
          </div>
          <p>
            We may modify these Terms at any time. Continued use constitutes acceptance. Governing law: India.
          </p>
          <a
            href={TERMS_FULL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex font-semibold text-primary hover:underline"
          >
            Read full Terms at taatom.com →
          </a>
        </div>
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">
          <Button onClick={onClose} className="w-full rounded-xl">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

const schema = z
  .object({
    fullName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be less than 50 characters"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be less than 20 characters")
      .regex(/^[a-z0-9_.]+$/, "Only lowercase letters, numbers, dots (.), and underscores (_) allowed"),
    email: z.string().email("Please enter a valid email"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
    termsAccepted: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.termsAccepted === true, {
    message: "You must accept the Terms & Conditions to create an account",
    path: ["termsAccepted"],
  });

type FormValues = z.infer<typeof schema>;

const USERNAME_DEBOUNCE_MS = 600;

export default function RegisterClient() {
  const router = useRouter();
  const [usernameAvailable, setUsernameAvailable] = React.useState<boolean | undefined>(undefined);
  const [isCheckingUsername, setIsCheckingUsername] = React.useState(false);
  const [termsPopupOpen, setTermsPopupOpen] = React.useState(false);
  const usernameCheckTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
  });

  const username = form.watch("username");

  // Debounced username availability check (mirror frontend)
  React.useEffect(() => {
    const raw = username ?? "";
    const sanitized = raw.toLowerCase().trim();
    if (sanitized.length < 3) {
      setUsernameAvailable(undefined);
      setIsCheckingUsername(false);
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
        usernameCheckTimeoutRef.current = null;
      }
      return;
    }

    setIsCheckingUsername(true);
    setUsernameAvailable(undefined);
    if (usernameCheckTimeoutRef.current) clearTimeout(usernameCheckTimeoutRef.current);

    usernameCheckTimeoutRef.current = setTimeout(async () => {
      usernameCheckTimeoutRef.current = null;
      try {
        const result = await checkUsernameAvailability(sanitized);
        if (typeof result.available === "boolean") {
          setUsernameAvailable(result.available);
          if (!result.available) {
            form.setError("username", { message: "Username already exists" });
          } else {
            form.clearErrors("username");
          }
        }
      } catch {
        // Leave availability undefined on network error
      } finally {
        setIsCheckingUsername(false);
      }
    }, USERNAME_DEBOUNCE_MS);

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
        usernameCheckTimeoutRef.current = null;
      }
    };
  }, [username, form]);

  // Keep username lowercase
  React.useEffect(() => {
    if (username && username !== username.toLowerCase()) {
      form.setValue("username", username.toLowerCase(), { shouldValidate: true });
    }
  }, [username, form]);

  const onSubmit = async (values: FormValues) => {
    if (!values.termsAccepted) {
      toast.error("You must accept the Terms & Conditions to create an account");
      return;
    }
    if (usernameAvailable === false) {
      toast.error("Please choose an available username");
      return;
    }
    try {
      await authSignUp({
        fullName: values.fullName,
        username: values.username,
        email: values.email,
        password: values.password,
        termsAccepted: true,
      });
      toast.success("Verification code sent. Please check your inbox and spam folder.");
      router.replace(`/auth/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to sign up");
    }
  };

  const termsAccepted = form.watch("termsAccepted");
  const canSubmit = termsAccepted && usernameAvailable !== false && !isCheckingUsername;

  return (
    <div className="mx-auto grid max-w-md gap-6 py-10">
      <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
        <iframe
          title="Register animation"
          src={LOTTIE_EMBED_URL}
          className="h-44 w-full border-0 sm:h-52"
          allowFullScreen
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Join Taatom and start sharing trips.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Full name</label>
              <Input {...form.register("fullName")} placeholder="Jane Doe" autoComplete="name" />
              {form.formState.errors.fullName && (
                <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Username</label>
              <Input
                {...form.register("username")}
                placeholder="janedoe"
                autoComplete="username"
                className={usernameAvailable === true ? "border-green-500" : usernameAvailable === false ? "border-destructive" : undefined}
              />
              {form.formState.errors.username && (
                <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
              )}
              {isCheckingUsername && (
                <p className="text-xs text-amber-600">Checking availability…</p>
              )}
              {!form.formState.errors.username && usernameAvailable === true && (
                <p className="text-xs text-green-600">Username is available!</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Email</label>
              <Input {...form.register("email")} type="email" placeholder="you@example.com" autoComplete="email" />
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
              <p className="text-xs text-muted-foreground">
                At least 6 characters, one uppercase, one lowercase, one number, one special character.
              </p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-semibold">Confirm password</label>
              <Input {...form.register("confirmPassword")} type="password" autoComplete="new-password" />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...form.register("termsAccepted")}
                  className="mt-1 h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">
                  I accept the{" "}
                  <button
                    type="button"
                    onClick={() => setTermsPopupOpen(true)}
                    className="font-semibold text-primary hover:underline"
                  >
                    Terms &amp; Conditions
                  </button>
                  . No objectionable, abusive, sexual, violent, hateful, or illegal content. Violations may result in suspension.
                </span>
              </label>
              {form.formState.errors.termsAccepted && (
                <p className="text-xs text-destructive">{form.formState.errors.termsAccepted.message}</p>
              )}
              <button
                type="button"
                onClick={() => setTermsPopupOpen(true)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View full Terms →
              </button>
            </div>

            {termsPopupOpen && (
              <TermsPopup onClose={() => setTermsPopupOpen(false)} />
            )}

            <Button type="submit" disabled={form.formState.isSubmitting || !canSubmit}>
              {form.formState.isSubmitting ? "Creating…" : !termsAccepted ? "Accept terms to continue" : "Create account"}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
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
