import { describe, expect, it } from "vitest";
import { assertNotProfane } from "@/server/lib/content-moderation";

describe("assertNotProfane", () => {
  it("does not throw for ordinary fitness/nutrition text", () => {
    expect(() =>
      assertNotProfane("Anyone have tips for hitting 150g of protein on a vegetarian diet?", "Content"),
    ).not.toThrow();
  });

  it("throws a BAD_REQUEST TRPCError for a blocklisted word", () => {
    // "bad-words"'s own default list — not something specific to this app.
    expect(() => assertNotProfane("you are a bastard", "Content")).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });

  it("includes the field name in the error message so the UI can show a useful message", () => {
    try {
      assertNotProfane("you are a bastard", "Title");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("Title");
    }
  });
});
