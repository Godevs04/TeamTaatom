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
  {
    q: "How does Creator Monetization work?",
    a: "Open your profile and choose Creator Dashboard. You need 100 followers, 4 eligible videos in the calendar month, and 2,000 eligible views, then you activate it yourself. Earnings use eligible views only and stay pending until the Asia/Kolkata month is validated. The minimum withdrawal is ₹1000 after identity verification. Two months below the requirements lock new earnings. One later qualifying month unlocks the same account. Photos do not earn, and YouTube imports earn only if TAATOM marks that video eligible. Buying views, bots, or view exchanges can end the program. This is separate from Connect subscriptions.",
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
