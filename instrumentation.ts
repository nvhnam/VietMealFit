import type { Instrumentation } from "next";

// Deployment-hardening (Phase 8) error monitoring. Default: structured
// console.error, which Vercel's free-tier Runtime Logs already captures and
// makes searchable — zero-setup, zero-cost, same "free tier by default"
// philosophy as the AI provider abstraction (server/ai/provider.ts). If a
// paid observability provider is ever wanted, forward `err`/`request`/`context`
// to it here, gated behind an env var (e.g. SENTRY_DSN), the same optional-
// upgrade pattern used for ANTHROPIC_API_KEY.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;

  console.error("[server-error]", {
    message,
    digest,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
