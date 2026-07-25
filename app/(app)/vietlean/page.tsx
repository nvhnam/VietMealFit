import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";
import { VietLeanCalculator } from "@/features/vietlean/components/vietlean-calculator";

export default async function VietLeanPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <VietLeanCalculator />
    </AdvancedModeGate>
  );
}
