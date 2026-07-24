import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";

export default async function VietSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <ModulePlaceholder
        title="VietSearch"
        description="Vietnamese nutrition dictionary — search 526 official food items for calories, protein, carbs, and fat per gram."
        phase="Phase 3"
      />
    </AdvancedModeGate>
  );
}
