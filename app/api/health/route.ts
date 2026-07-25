import { sql } from "drizzle-orm";
import { db } from "@/server/db";

// Deployment-hardening (Phase 8): a single lightweight endpoint serving two
// purposes — (1) an uptime/monitoring target, (2) the keep-alive ping that
// exercises the real DB path so Supabase's free-tier project-pause-on-inactivity
// never triggers (see .github/workflows/keepalive-backup.yml).
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 503 }
    );
  }
}
