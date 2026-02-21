"use client";

import * as React from "react";
import QueryProvider from "./query-provider";
import ThemeProvider from "./theme-provider";
import { AuthProvider } from "../context/auth-context";
import { Toaster } from "sonner";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

