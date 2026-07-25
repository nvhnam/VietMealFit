import { defineConfig } from "vitest/config";

// `resolve.conditions: ["react-server"]` matches how the codebase's
// throwaway verification scripts have always run server code outside
// Next.js (NODE_OPTIONS="--conditions=react-server" npx tsx ...) — it's the
// same Node export-condition mechanism Next.js's bundler uses to select the
// no-op export of the `server-only` guard package instead of the one that
// throws outside a server runtime.
export default defineConfig({
  resolve: {
    conditions: ["react-server"],
    tsconfigPaths: true,
  },
  // Vitest resolves node_modules deps through Vite's SSR pipeline, which
  // uses `ssr.resolve.conditions` rather than the top-level `resolve.
  // conditions` above (that one only governs client-graph resolution) — both
  // need to agree, or `server-only` still picks the throwing export.
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ["tests/**/*.test.ts"],
    // Integration tests hit a real (non-pooled, port-5432) Postgres
    // connection with a real connection-count ceiling. Running test files
    // in parallel workers (Vitest's default) means each file's `db` import
    // opens its own postgres.js pool (up to 10 connections) concurrently —
    // with 5 integration files that's up to 50 at once, which reliably
    // triggers ECONNRESET well before the connection limit is officially
    // exhausted. Sequential file execution keeps this suite reliable.
    fileParallelism: false,
  },
});
