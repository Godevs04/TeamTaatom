"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Globe2, Camera, Users } from "lucide-react";

const steps = [
  {
    icon: Globe2,
    title: "Discover amazing places",
    description: "Explore locations shared by travelers around the world",
    color: "text-sky-600",
  },
  {
    icon: Camera,
    title: "Share your journey",
    description: "Capture and share your travel experiences with the community",
    color: "text-rose-600",
  },
  {
    icon: Users,
    title: "Connect with travelers",
    description: "Follow inspiring people and discover new destinations",
    color: "text-emerald-600",
  },
];

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);

  const goNext = () => {
    if (step < steps.length - 1) setStep((s) => s + 1);
    else router.replace("/onboarding/languages");
  };

  const skip = () => router.replace("/onboarding/languages");

  const data = steps[step];
  const Icon = data.icon;

  return (
    <div className="mx-auto max-w-lg rounded-[1.25rem] border border-slate-200/90 bg-white/95 p-8 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-primary">Step 1 of 5</p>
        <button type="button" onClick={skip} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
          Skip
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
          className="space-y-6 text-center"
        >
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 ${data.color}`}>
            <Icon className="h-8 w-8" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-[1.65rem]">{data.title}</h1>
            <p className="text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">{data.description}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-center gap-2">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-slate-200"}`}
          />
        ))}
      </div>

      <Button type="button" className="mt-8 h-12 w-full rounded-xl font-semibold" onClick={goNext}>
        {step < steps.length - 1 ? "Next" : "Continue"}
      </Button>
    </div>
  );
}
