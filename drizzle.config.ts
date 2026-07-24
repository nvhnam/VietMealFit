import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit's CLI doesn't auto-load .env.local (that's a Next.js convention) —
// load it explicitly so `db:push`/`db:generate` see the same DATABASE_URL the app uses.
config({ path: ".env.local" });

// `generate` only reads schema.ts and doesn't need a live DB, so no throw here —
// only server/db/index.ts (actual runtime queries) enforces DATABASE_URL being set.
export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    ssl: "require",
  },
  schemaFilter: ["public"], // never migrate Supabase's own `auth` schema
});
