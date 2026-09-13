import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";
import { ResourceList } from "@/features/vietsmart/components/resource-list";

export default async function VietSmartPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <ResourceList />
    </AdvancedModeGate>
  );
}
