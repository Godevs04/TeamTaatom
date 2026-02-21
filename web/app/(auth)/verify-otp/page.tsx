import VerifyOtpClient from "./verify-otp-client";

export default function VerifyOtpPage({ searchParams }: { searchParams?: { email?: string } }) {
  return <VerifyOtpClient email={searchParams?.email} />;
}

