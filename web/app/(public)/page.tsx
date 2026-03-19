import { LandingLoginClient } from "./landing-login-client";

export default function LandingPage({ searchParams }: { searchParams?: { next?: string } }) {
  const nextUrl = searchParams?.next || "/feed";
  return (
    <div className="w-full">
      <LandingLoginClient nextUrl={nextUrl} />
    </div>
  );
}
