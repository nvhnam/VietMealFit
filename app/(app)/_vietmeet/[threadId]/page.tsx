import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";
import { ThreadDetail } from "@/features/vietmeet/components/thread-detail";

export default async function VietMeetThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);
  const { threadId } = await params;

  return (
    <AdvancedModeGate mode={mode}>
      <ThreadDetail threadId={threadId} />
    </AdvancedModeGate>
  );
}
