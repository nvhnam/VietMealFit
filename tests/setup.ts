import { config } from "dotenv";
import path from "node:path";

// Vitest doesn't read Next.js's .env.local automatically (only `next` itself
// does) — load it explicitly so integration tests hit the real dev Supabase
// project the rest of this codebase's verification scripts have always used.
config({ path: path.resolve(__dirname, "../.env.local") });
