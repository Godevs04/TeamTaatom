"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function ContactSupportSettingsPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70 md:p-7"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.035] via-transparent to-transparent" />

        <h2 className="relative font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Contact Support
        </h2>

        <p className="relative mt-2 text-sm text-slate-600 dark:text-slate-400">
          For quick questions, you can reach us directly at{" "}
          <a href="mailto:contact@taatom.com" className="font-medium text-primary hover:underline">
            contact@taatom.com
          </a>
          .
        </p>

        <motion.a
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          href="mailto:contact@taatom.com"
          className="relative mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/40 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-slate-300 dark:hover:bg-zinc-700"
        >
          <Mail className="h-4 w-4" /> contact@taatom.com
        </motion.a>
      </motion.div>
    </div>
  );
}
