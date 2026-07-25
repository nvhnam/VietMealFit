import { AdvancedModeGate } from "@/components/shared/advanced-mode-gate";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";
import { VietSearchPageClient } from "@/features/vietsearch/components/vietsearch-page-client";

export default async function VietSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const mode = await getServerExperienceMode((await searchParams).mode);

  return (
    <AdvancedModeGate mode={mode}>
      <VietSearchPageClient />
    </AdvancedModeGate>
  );
}
