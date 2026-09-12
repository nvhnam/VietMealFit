"use client";

import { useState, type ReactNode } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FOOD_GROUPS, foodGroupLabel } from "@/features/vietsearch/food-groups";
import { IngredientCombobox, type IngredientOption } from "./ingredient-combobox";
import { VietSearchResults } from "./vietsearch-results";

const MIN_GRAMS = 100;

export function VietSearchPageClient() {
  const trpc = useTRPC();
  const { t, language } = useI18n();
  const [group, setGroup] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<IngredientOption | null>(null);
  const [gramsInput, setGramsInput] = useState(String(MIN_GRAMS));
  const [submitted, setSubmitted] = useState<{ id: string; grams: number } | null>(null);

  // The book's 14 food groups, in its order and the reader's language. An array,
  // not an object: object keys "1".."14" would be listed before "__all__".
  const groupOptions: { value: string; label: ReactNode }[] = [
    { value: "__all__", label: t.vietsearch.allCategories },
    ...FOOD_GROUPS.map((g) => ({ value: String(g.group), label: foodGroupLabel(g, language) })),
  ];
  // `items` is what makes <SelectValue> render the label rather than the raw
  // value — without it the trigger literally reads "__all__".
  const groupItems: Record<string, ReactNode> = Object.fromEntries(groupOptions.map((o) => [o.value, o.label]));

  const gramsValue = Number(gramsInput);
  const gramsValid = Number.isFinite(gramsValue) && gramsValue >= MIN_GRAMS;
  const showGramsError = gramsInput.trim() !== "" && !gramsValid;

  const {
    data: result,
    isLoading: isResultLoading,
    isError,
  } = useQuery(trpc.vietsearch.getNutrients.queryOptions(submitted ?? skipToken));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader icon={Search} title={t.vietsearch.title} description={t.vietsearch.description} />
      <Card className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t.vietsearch.categoryLabel}</Label>
            <Select
              items={groupItems}
              value={group === undefined ? "__all__" : String(group)}
              onValueChange={(v) => {
                if (!v) return;
                setGroup(v === "__all__" ? undefined : Number(v));
                setSelected(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groupOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t.vietsearch.ingredientLabel}</Label>
            <IngredientCombobox value={selected} onSelect={setSelected} group={group} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grams">{t.vietsearch.gramsLabel(MIN_GRAMS)}</Label>
            <Input
              id="grams"
              type="number"
              min={MIN_GRAMS}
              value={gramsInput}
              onChange={(e) => setGramsInput(e.target.value)}
              aria-invalid={showGramsError}
            />
            {showGramsError && (
              <p className="text-xs text-destructive">{t.vietsearch.gramsError(MIN_GRAMS)}</p>
            )}
          </div>

          <Button
            disabled={!selected || !gramsValid}
            onClick={() => selected && setSubmitted({ id: selected.id, grams: gramsValue })}
          >
            {t.vietsearch.lookupButton}
          </Button>
        </div>
      </Card>

      {isResultLoading && (
        <Card className="p-6">
          <Skeleton className="mb-3 h-5 w-64" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </Card>
      )}

      {isError && (
        <p className="text-sm text-destructive">{t.vietsearch.errorLoadingNutrition}</p>
      )}

      {!isResultLoading && submitted && result && <VietSearchResults result={result} />}
    </div>
  );
}
