/** Extracts a YouTube video ID (and optional start-time in seconds) from any
 * of the URL shapes YouTube itself hands out (watch, youtu.be, embed,
 * shorts). Returns null for anything else so callers can fall back to a
 * plain outbound link instead of embedding.
 */
export function parseYouTubeUrl(url: string): { videoId: string; startSeconds: number | null } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\.|^m\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = parsed.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      videoId = parsed.pathname.slice("/embed/".length).split("/")[0] || null;
    } else if (parsed.pathname.startsWith("/shorts/")) {
      videoId = parsed.pathname.slice("/shorts/".length).split("/")[0] || null;
    }
  }

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;

  const startParam = parsed.searchParams.get("start") ?? parsed.searchParams.get("t");
  const startSeconds = startParam ? parseInt(startParam, 10) : null;

  return { videoId, startSeconds: Number.isFinite(startSeconds) && startSeconds ? startSeconds : null };
}
