import { Card } from "@/components/ui/card";

export function ModulePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <Card className="p-8">
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      <p className="mb-4 text-muted-foreground">{description}</p>
      <p className="text-sm text-muted-foreground">Implementation lands in {phase}.</p>
    </Card>
  );
}
