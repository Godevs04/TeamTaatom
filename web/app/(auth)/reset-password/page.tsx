import ResetPasswordClient from "./reset-password-client";

export default function ResetPasswordPage({ searchParams }: { searchParams?: { email?: string } }) {
  return <ResetPasswordClient email={searchParams?.email} />;
}

