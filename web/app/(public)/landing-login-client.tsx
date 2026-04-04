"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/auth-context";
import { getFriendlyAuthErrorMessage } from "../../lib/auth-errors";
import { Camera, Compass, Eye, EyeOff, MapPin, Music2 } from "lucide-react";

const LOTTIE_EMBED_URL =
  "https://lottie.host/embed/de6e7dfe-658a-422c-9dbd-06d959550e52/Oh0ZqzklZE.lottie";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(6, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const features = [
  {
    icon: MapPin,
    title: "Places with context",
    body: "Pin moments to real locations so every story lands with meaning.",
    n: "01",
  },
  {
    icon: Camera,
    title: "Rich visual stories",
    body: "Photos and sequences that feel editorial — craft, not clutter.",
    n: "02",
  },
  {
    icon: Music2,
    title: "Mood that travels",
    body: "Sound and vibe travel with your posts for a fuller memory.",
    n: "03",
  },
] as const;

const easeOut = [0.22, 1, 0.36, 1] as const;

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
};

const itemFadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOut },
  },
};

const headlineVariant = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: easeOut },
  },
};

export function LandingLoginClient({ nextUrl = "/feed" }: { nextUrl?: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading, signIn } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const scrollToSignIn = React.useCallback(() => {
    document.getElementById("landing-sign-in")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

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
      toast.error(getFriendlyAuthErrorMessage(e));
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
    <div className="landing-bg relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/30" />

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 sm:gap-12 sm:px-6 sm:pb-16 sm:pt-12 md:grid-cols-2 md:items-start md:gap-14 lg:px-8 lg:pb-20 lg:pt-14">
        {/* Left: animated copy + Lottie (not at page bottom) */}
        <motion.div
          className="flex flex-col justify-center space-y-7"
          variants={containerStagger}
          initial="hidden"
          animate="show"
        >
          <motion.p variants={itemFadeUp} className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Taatom
          </motion.p>
          <motion.h1
            variants={headlineVariant}
            className="font-display text-[2rem] font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-4xl md:text-[2.65rem] lg:text-[2.85rem]"
          >
            Where your journeys become something people feel.
          </motion.h1>
          <motion.p
            variants={itemFadeUp}
            className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg"
          >
            Discover trips, places, and creators. Share posts with photos, locations, and music — a calmer space for
            travelers who care about craft, not clutter.
          </motion.p>
          <motion.div variants={itemFadeUp} className="flex flex-wrap items-center gap-3 sm:gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
              <Button
                asChild
                className="h-12 rounded-full bg-slate-950 px-7 text-base font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-900"
              >
                <Link href="/auth/register">Create free account</Link>
              </Button>
            </motion.div>
            <motion.button
              type="button"
              onClick={scrollToSignIn}
              whileHover={{ x: 2 }}
              className="text-sm font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
            >
              I already have an account
            </motion.button>
          </motion.div>
          <motion.div
            variants={itemFadeUp}
            className="flex flex-col gap-3 pt-1 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6"
          >
            <motion.span
              className="inline-flex items-center gap-2"
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Compass className="h-4 w-4" aria-hidden />
              </span>
              Built for explorers &amp; storytellers
            </motion.span>
            <motion.span
              className="inline-flex items-center gap-2"
              whileHover={{ x: 4 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              Location-aware, human-first
            </motion.span>
          </motion.div>

          {/* Lottie sits in hero under the story — balances the sign-in card */}
          <motion.div
            variants={itemFadeUp}
            className="relative mt-2 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-sm backdrop-blur-sm"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-violet-500/[0.05]" />
            <iframe
              title="Taatom landing animation"
              src={LOTTIE_EMBED_URL}
              className="relative block h-[200px] w-full border-0 sm:h-[240px] md:h-[260px]"
              allowFullScreen
            />
          </motion.div>
        </motion.div>

        {/* Sign-in card */}
        <div className="flex justify-center md:justify-end md:pt-4">
          <motion.div
            id="landing-sign-in"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
            className="w-full max-w-md scroll-mt-28 rounded-[1.75rem] border border-slate-200/90 bg-white/95 p-6 shadow-premium backdrop-blur-sm sm:p-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.45, ease: easeOut }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Welcome back</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.65rem]">
                Sign in to Taatom
              </h2>
              <p className="mt-1 text-sm text-slate-500">Pick up where you left off on web.</p>
            </motion.div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-5">
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
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Input
                    {...form.register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
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
          </motion.div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {features.map(({ icon: Icon, title, body, n }, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, ease: easeOut, delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.25, ease: easeOut } }}
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-shadow duration-300 hover:shadow-premium sm:p-7"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              <span className="pointer-events-none absolute bottom-4 right-5 font-display text-3xl font-semibold tabular-nums text-slate-200/90">
                {n}
              </span>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
