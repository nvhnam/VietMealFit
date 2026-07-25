"use client";

import { Flame, Beef, Wheat, Droplet, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type NutrientResult = {
  nameVi: string;
  nameEn: string | null;
  grams: number;
  energyKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  sourceCitation: string;
};

function formatValue(value: number | null, unit: string): string {
  return value === null ? "—" : `${value}${unit}`;
}

const STATS = [
  { key: "energyKcal" as const, label: "Calories", unit: " kcal", icon: Flame },
  { key: "proteinG" as const, label: "Protein", unit: "g", icon: Beef },
  { key: "carbohydrateG" as const, label: "Carbs", unit: "g", icon: Wheat },
  { key: "fatG" as const, label: "Fat", unit: "g", icon: Droplet },
];

export function VietSearchResults({ result }: { result: NutrientResult }) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold">
        Results for {result.grams}g of {result.nameVi}
        {result.nameEn && <span className="font-normal text-muted-foreground"> ({result.nameEn})</span>}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map(({ key, label, unit, icon: Icon }) => {
          const value = result[key];
          return (
            <div
              key={key}
              className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/30 p-4 text-center"
            >
              <Icon
                className={cn("size-5", value === null ? "text-muted-foreground/50" : "text-primary")}
                aria-hidden="true"
              />
              <span className="text-lg font-semibold tabular-nums">{formatValue(value, unit)}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
              {value === null && <span className="text-[10px] text-muted-foreground">not measured</span>}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>Source: {result.sourceCitation}</span>
      </div>
    </Card>
  );
}
