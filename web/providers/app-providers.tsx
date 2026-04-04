"use client";

import * as React from "react";
import QueryProvider from "./query-provider";
import ThemeProvider from "./theme-provider";
import { AuthProvider } from "../context/auth-context";
import { ForceLightTheme } from "../components/force-light-theme";
import { Toaster } from "sonner";

function ToasterAfterMount() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <Toaster richColors position="top-right" />;
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ForceLightTheme />
      <QueryProvider>
        <AuthProvider>
          {children}
          <ToasterAfterMount />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

