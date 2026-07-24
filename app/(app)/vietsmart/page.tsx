import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";

export default async function VietSmartPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <ModulePlaceholder
        title="VietSmart"
        description="E-library — upload, search, and download fitness resources, stored centrally (not per-browser)."
        phase="Phase 4"
      />
    </AdvancedModeGate>
  );
}
