import { Filter } from "bad-words";
import { TRPCError } from "@trpc/server";

// Basic, deterministic content moderation for community-authored text
// (VietMeet threads/comments) — a blocklist filter, not an ML classifier.
// Good enough to catch the obvious cases (plan §7's "basic content-
// moderation checks"); nothing here replaces human moderation for edge
// cases, which is why admins can still delete/moderate directly (D5).
const filter = new Filter();

export function assertNotProfane(text: string, field: string): void {
  if (filter.isProfane(text)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${field} contains language that isn't allowed here.`,
    });
  }
}
