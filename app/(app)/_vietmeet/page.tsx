import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";
import { ThreadList } from "@/features/vietmeet/components/thread-list";

export default async function VietMeetPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <ThreadList />
    </AdvancedModeGate>
  );
}
