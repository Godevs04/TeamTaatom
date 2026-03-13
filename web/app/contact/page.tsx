"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const minMessageLength = 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !subject || message.trim().length < minMessageLength) return;
    setSubmitting(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/v1/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, subject, message }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setFullName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = email.trim() && subject.trim() && message.trim().length >= minMessageLength;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:px-4 sm:py-10 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      {/* Hero */}
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-6 shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-8 md:px-10">
        <div className="max-w-3xl text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
            Contact Taatom
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Have a question or feedback?
          </h1>
          <p className="mt-3 text-sm text-slate-100/90">
            Reach out to us for support, partnerships, feedback, or anything else related to your
            Taatom experience. We read every message carefully.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-50/90 sm:text-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/15 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Typically replies within 1–3 business days.
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/15 px-3 py-1.5">
              <span className="text-sky-100">✉</span>
              <span className="truncate">
                Direct email:{" "}
                <a
                  href="mailto:contact@taatom.com"
                  className="font-semibold text-sky-50 underline underline-offset-2"
                >
                  contact@taatom.com
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.1fr)] md:items-start">
        <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-7">
          <h2 className="text-base font-semibold text-slate-900 md:text-lg">
            How can we help you?
          </h2>
          <p className="text-sm text-slate-600">
            Tell us what you need help with. The more detail you share, the better we can assist
            you.
          </p>
          <div className="mt-2 grid gap-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="font-medium text-slate-900">Product support &amp; bugs</p>
              <p className="mt-1 text-xs text-slate-600">
                Issues with the app or web experience, account problems, or something not working as
                expected.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="font-medium text-slate-900">Feedback &amp; feature ideas</p>
              <p className="mt-1 text-xs text-slate-600">
                Suggestions that can make Taatom better for you and other travelers.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="font-medium text-slate-900">Partnerships &amp; business</p>
              <p className="mt-1 text-xs text-slate-600">
                Collaborations, brand partnerships, or media inquiries related to Taatom.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-7">
          <h2 className="text-base font-semibold text-slate-900 md:text-lg">Send us a message</h2>
          <p className="mt-1 text-xs text-slate-600">
            Fields marked with <span className="text-rose-500">*</span> are required.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 outline-none ring-primary/30 placeholder:text-slate-400 focus:border-primary focus:ring-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 outline-none ring-primary/30 placeholder:text-slate-400 focus:border-primary focus:ring-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Subject <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What is this regarding?"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 outline-none ring-primary/30 placeholder:text-slate-400 focus:border-primary focus:ring-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Message <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us more about your inquiry..."
                rows={5}
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 outline-none ring-primary/30 placeholder:text-slate-400 focus:border-primary focus:ring-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                Minimum {minMessageLength} characters required (
                {Math.max(0, minMessageLength - message.trim().length)} remaining).
              </p>
            </div>

            <button
              type="submit"
              disabled={!isValid || submitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition-opacity disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:px-8"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Sending…" : "Send Message"}
            </button>

            {status === "success" && (
              <p className="mt-2 text-xs font-medium text-emerald-600">
                Thank you! Your message has been sent.
              </p>
            )}
            {status === "error" && (
              <p className="mt-2 text-xs font-medium text-red-600">
                Sorry, we couldn&apos;t send your message. Please try again in a moment.
              </p>
            )}
          </form>

          <p className="mt-4 text-xs text-slate-500">
            You can also reach us directly at{" "}
            <a href="mailto:contact@taatom.com" className="font-medium text-primary hover:underline">
              contact@taatom.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

