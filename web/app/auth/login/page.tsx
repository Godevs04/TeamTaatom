import LoginClient from "./login-client";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; email?: string };
}) {
  return <LoginClient nextUrl={searchParams?.next} initialEmail={searchParams?.email} />;
}
