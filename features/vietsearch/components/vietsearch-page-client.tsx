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
import { IngredientCombobox, type IngredientOption } from "./ingredient-combobox";
import { VietSearchResults } from "./vietsearch-results";

const MIN_GRAMS = 100;

export function VietSearchPageClient() {
  const trpc = useTRPC();
  const { t } = useI18n();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<IngredientOption | null>(null);
  const [gramsInput, setGramsInput] = useState(String(MIN_GRAMS));
  const [submitted, setSubmitted] = useState<{ id: string; grams: number } | null>(null);

  const { data: categories } = useQuery(trpc.vietsearch.getCategories.queryOptions());

  // `items` is what makes <SelectValue> render the label rather than the raw
  // value — without it the trigger literally reads "__all__".
  const categoryItems: Record<string, ReactNode> = {
    __all__: t.vietsearch.allCategories,
    ...Object.fromEntries((categories ?? []).map((c) => [c, c])),
  };

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
              items={categoryItems}
              value={category ?? "__all__"}
              onValueChange={(v) => {
                if (!v) return;
                setCategory(v === "__all__" ? undefined : v);
                setSelected(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t.vietsearch.ingredientLabel}</Label>
            <IngredientCombobox value={selected} onSelect={setSelected} category={category} />
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
