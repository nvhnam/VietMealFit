import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";

export default async function VietMeetPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <ModulePlaceholder
        title="VietMeet"
        description="Community forum — real, shared threads and comments (replacing the original prototype's browser-only localStorage)."
        phase="Phase 4"
      />
    </AdvancedModeGate>
  );
}
