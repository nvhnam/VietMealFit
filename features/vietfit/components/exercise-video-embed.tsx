"use client";

import { useI18n } from "@/features/i18n";
import { parseYouTubeUrl } from "@/features/vietfit/youtube";

/**
 * Renders an inline YouTube player (youtube-nocookie.com, per plan §8 privacy
 * stance) so users watch the exercise demo in place rather than leaving the
 * app. Non-YouTube URLs fall back to a plain outbound link — data quality
 * for video_url isn't guaranteed to always be YouTube.
 */
export function ExerciseVideoEmbed({ videoUrl, exerciseName }: { videoUrl: string | null; exerciseName: string }) {
  const { t } = useI18n();

  if (!videoUrl) {
    return <p className="text-sm text-muted-foreground">{t.vietfit.videoNotYetAdded}</p>;
  }

  const parsed = parseYouTubeUrl(videoUrl);
  if (!parsed) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t.vietfit.watchVideo}
      </a>
    );
  }

  const src = `https://www.youtube-nocookie.com/embed/${parsed.videoId}${
    parsed.startSeconds ? `?start=${parsed.startSeconds}` : ""
  }`;

  return (
    <div className="aspect-video w-full max-w-md overflow-hidden rounded-md bg-black">
      <iframe
        className="h-full w-full"
        src={src}
        title={`${exerciseName} — ${t.vietfit.watchVideo}`}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
