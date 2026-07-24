import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";

export default async function VietLeanPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <ModulePlaceholder
        title="VietLean"
        description="Calorie & macronutrient calculator — daily targets and food-category guidance by bulking/lean/cutting phase."
        phase="Phase 2"
      />
    </AdvancedModeGate>
  );
}
