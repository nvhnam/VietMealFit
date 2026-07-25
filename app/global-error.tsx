"use client";

import { useEffect } from "react";
import "./globals.css";

// Only catches errors thrown by the root layout itself (rare) — app/error.tsx
// handles everything else. Must define its own <html>/<body>; the root layout
// isn't mounted when this renders.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center antialiased">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The app failed to load. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
