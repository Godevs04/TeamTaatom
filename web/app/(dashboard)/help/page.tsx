"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Mail, Shield, Smartphone } from "lucide-react";

const faqs = [
  {
    q: "How do I share a trip?",
    a: "Open Create, add photos or a short video, set a place if you like, then publish. Your post appears on your profile and in the feed.",
  },
  {
    q: "What is Connect?",
    a: "Connect lets you follow creator pages and optionally subscribe to exclusive content. Open Connect from the sidebar to browse communities.",
  },
  {
    q: "How does Navigate work on web?",
    a: "Navigate uses your browser location while this tab stays open. For full background GPS tracking, use the Taatom mobile app.",
  },
  {
    q: "Taatom music on shorts",
    a: "When uploading a short, choose Use Taatom music to pick a licensed track from our library and optional trim points.",
  },
];

export default function HelpCenterPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-24 lg:pb-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wider">Help</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">Help center</h1>
        <p className="text-slate-600 dark:text-zinc-400">
          Quick answers for Taatom on the web. For account issues, contact support.
        </p>
      </motion.div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/contact"
          className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-primary/30 dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <Mail className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Contact support</p>
            <p className="text-xs text-slate-500">Reach the team for bugs or account help.</p>
          </div>
        </Link>
        <a
          href="/terms"
          className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-primary/30 dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <Shield className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Terms & policies</p>
            <p className="text-xs text-slate-500">Community guidelines and legal.</p>
          </div>
        </a>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">FAQs</h2>
        </div>
        <ul className="space-y-4">
          {faqs.map((item) => (
            <li
              key={item.q}
              className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <p className="font-semibold text-slate-900 dark:text-white">{item.q}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{item.a}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
