import "server-only";

import { headers } from "next/headers";

/**
 * The public origin this request is being served from, e.g.
 * "https://vietmealfit.vercel.app" or "http://localhost:3000" — no trailing slash.
 *
 * Needed because Supabase builds the confirmation link's `redirect_to` from
 * whatever we hand it at signUp() time. Hand it nothing and Supabase falls back
 * to the project's dashboard "Site URL", which defaults to http://localhost:3000
 * — that is exactly why confirmation emails from production were bouncing users
 * to localhost.
 *
 * Resolution order, most trustworthy first:
 *  1. NEXT_PUBLIC_SITE_URL — explicit, and the only one that survives custom
 *     domains and non-Vercel hosts.
 *  2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's *stable* production hostname.
 *     Deliberately not VERCEL_URL: that is a fresh per-deployment hostname
 *     (vietmealfit-abc123-nvhnam.vercel.app), so it could never be enumerated
 *     in Supabase's redirect allow-list.
 *  3. The request's own forwarded host — self-configuring, and safe here only
 *     because Supabase's allow-list is the actual security boundary: a spoofed
 *     Host header produces a redirect_to that Supabase refuses to honour.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) return `https://${productionHost}`;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (host) {
    const protocol =
      headerList.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

/** Where Supabase should send the user after it verifies an emailed link. */
export async function getAuthCallbackUrl(): Promise<string> {
  return `${await getSiteUrl()}/auth/callback`;
}
