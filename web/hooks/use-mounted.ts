"use client";

import * as React from "react";

/**
 * Returns true only after the component has mounted on the client.
 * Use to avoid hydration mismatch when rendering auth-dependent or client-only content.
 */
export function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
