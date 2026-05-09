export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-bg relative min-h-[calc(100vh-3.5rem)] w-full">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/30" />
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
    </div>
  );
}
