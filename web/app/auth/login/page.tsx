import LoginClient from "./login-client";

export default function LoginPage({ searchParams }: { searchParams?: { next?: string } }) {
  return <LoginClient nextUrl={searchParams?.next} />;
}
