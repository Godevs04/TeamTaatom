"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Compass, Camera, Users } from "lucide-react";

const steps = [
  { icon: Compass, title: "Discover places", desc: "Explore spots shared by travelers worldwide." },
  { icon: Camera, title: "Share your journey", desc: "Post trips, shorts, and moments from the road." },
  { icon: Users, title: "Connect", desc: "Follow travelers and join creator communities." },
];

export default function OnboardingWelcomePage() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Welcome</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">You&apos;re in</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Here&apos;s what you can do on Taatom.</p>
      </div>
      <ul className="space-y-4">
        {steps.map(({ icon: Icon, title, desc }) => (
          <li
            key={title}
            className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
              <p className="text-sm text-slate-600 dark:text-zinc-400">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1 rounded-xl">
          <Link href="/onboarding/interests">Continue</Link>
        </Button>
        <Button asChild variant="ghost" className="flex-1 rounded-xl">
          <Link href="/onboarding/interests">Skip intro</Link>
        </Button>
      </div>
    </motion.div>
  );
}
