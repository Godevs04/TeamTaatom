"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authSignUp, checkUsernameAvailability } from "@/lib/api";
import { getFriendlyAuthErrorMessage } from "@/lib/auth-errors";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { X, Eye, EyeOff } from "lucide-react";

const TERMS_FULL_URL = "https://www.taatom.com/terms";

function TermsPopup({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
    >
      <motion.div
        className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white/98 shadow-premium backdrop-blur-md"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-sm">
            <h2 id="terms-title" className="font-display text-lg font-semibold text-slate-900">
              Terms of Service
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[calc(85vh-4.5rem)] space-y-4 overflow-y-auto px-5 py-4 text-sm text-slate-600">
            <p>By using Taatom you agree to these Terms. If you disagree, you may not use the App.</p>
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
            <p>We may modify these Terms at any time. Continued use constitutes acceptance. Governing law: India.</p>
            <a
              href={TERMS_FULL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex font-semibold text-primary hover:underline"
            >
              Read full Terms at taatom.com →
            </a>
          </div>
          <div className="sticky bottom-0 border-t border-slate-200/80 bg-white/95 px-5 py-4 backdrop-blur-sm">
            <Button onClick={onClose} className="h-11 w-full rounded-xl font-semibold">
              Close
            </Button>
          </div>
        </motion.div>
    </motion.div>
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
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
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
      toast.error(getFriendlyAuthErrorMessage(e));
    }
  };

  const termsAccepted = form.watch("termsAccepted");
  const canSubmit = termsAccepted && usernameAvailable !== false && !isCheckingUsername;

  return (
    <>
      <AuthPageShell
        cardEyebrow="Join us"
        cardTitle="Create your account"
        cardSubtitle="A few details and you’re ready to explore Taatom on the web."
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-700">Full name</label>
            <Input
              {...form.register("fullName")}
              placeholder="Jane Doe"
              autoComplete="name"
              className="h-12 rounded-xl border-slate-200/90 bg-slate-50/80"
            />
            {form.formState.errors.fullName && (
              <p className="text-xs text-red-600">{form.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-700">Username</label>
            <Input
              {...form.register("username")}
              placeholder="janedoe"
              autoComplete="username"
              className={`h-12 rounded-xl border-slate-200/90 bg-slate-50/80 ${
                usernameAvailable === true
                  ? "border-green-500/80"
                  : usernameAvailable === false
                    ? "border-red-500/80"
                    : ""
              }`}
            />
            {form.formState.errors.username && (
              <p className="text-xs text-red-600">{form.formState.errors.username.message}</p>
            )}
            {isCheckingUsername && <p className="text-xs text-amber-600">Checking availability…</p>}
            {!form.formState.errors.username && usernameAvailable === true && (
              <p className="text-xs text-green-600">Username is available!</p>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <Input
              {...form.register("email")}
              type="email"
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
            <div className="relative">
              <Input
                {...form.register("password")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="h-12 rounded-xl border-slate-200/90 bg-slate-50/80 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
            )}
            <p className="text-xs text-slate-500">
              At least 6 characters, one uppercase, one lowercase, one number, one special character.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-700">Confirm password</label>
            <div className="relative">
              <Input
                {...form.register("confirmPassword")}
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                className="h-12 rounded-xl border-slate-200/90 bg-slate-50/80 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                {...form.register("termsAccepted")}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary"
              />
              <span className="text-sm text-slate-600">
                I accept the{" "}
                <button
                  type="button"
                  onClick={() => setTermsPopupOpen(true)}
                  className="font-semibold text-primary hover:underline"
                >
                  Terms &amp; Conditions
                </button>
                . No objectionable, abusive, sexual, violent, hateful, or illegal content. Violations may result in
                suspension.
              </span>
            </label>
            {form.formState.errors.termsAccepted && (
              <p className="text-xs text-red-600">{form.formState.errors.termsAccepted.message}</p>
            )}
            <button
              type="button"
              onClick={() => setTermsPopupOpen(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View full Terms →
            </button>
          </div>

          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.2 }}>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || !canSubmit}
              className="h-12 w-full rounded-xl bg-slate-950 text-base font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-900 disabled:opacity-60"
            >
              {form.formState.isSubmitting
                ? "Creating…"
                : !termsAccepted
                  ? "Accept terms to continue"
                  : "Create account"}
            </Button>
          </motion.div>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </AuthPageShell>

      <AnimatePresence mode="sync">
        {termsPopupOpen ? <TermsPopup key="terms" onClose={() => setTermsPopupOpen(false)} /> : null}
      </AnimatePresence>
    </>
  );
}
