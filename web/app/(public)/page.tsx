import { LandingLoginClient } from "./landing-login-client";

export default function LandingPage({ searchParams }: { searchParams?: { next?: string } }) {
  const nextUrl = searchParams?.next || "/feed";
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <LandingLoginClient nextUrl={nextUrl} />
    </div>
  );
}
