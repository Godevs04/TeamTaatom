"use client";

import * as React from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="mx-auto max-w-lg px-4 py-16">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                Go home
              </Button>
            </div>
          </Card>
        </div>
      </body>
    </html>
  );
}

