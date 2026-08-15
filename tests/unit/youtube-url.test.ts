import { describe, expect, it } from "vitest";
import { parseYouTubeUrl } from "@/features/vietfit/youtube";

describe("parseYouTubeUrl", () => {
  it("parses a standard watch URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startSeconds: null,
    });
  });

  it("parses a youtu.be short link", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startSeconds: null,
    });
  });

  it("parses an embed URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startSeconds: null,
    });
  });

  it("parses a shorts URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startSeconds: null,
    });
  });

  it("carries a start-time param through", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=42")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startSeconds: 42,
    });
  });

  it("returns null for a non-YouTube URL", () => {
    expect(parseYouTubeUrl("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(parseYouTubeUrl("not a url")).toBeNull();
  });

  it("returns null for a YouTube URL with no video id", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/results?search_query=squat")).toBeNull();
  });
});
