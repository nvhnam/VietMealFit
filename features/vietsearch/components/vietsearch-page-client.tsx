"use client";

import { useState } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<IngredientOption | null>(null);
  const [gramsInput, setGramsInput] = useState(String(MIN_GRAMS));
  const [submitted, setSubmitted] = useState<{ id: string; grams: number } | null>(null);

  const { data: categories } = useQuery(trpc.vietsearch.getCategories.queryOptions());

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
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-semibold">VietSearch</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Look up nutrition facts for Vietnamese food ingredients, scaled to any gram amount.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Category — optional filter</Label>
            <Select
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
                <SelectItem value="__all__">All categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Ingredient</Label>
            <IngredientCombobox value={selected} onSelect={setSelected} category={category} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grams">Grams (minimum {MIN_GRAMS})</Label>
            <Input
              id="grams"
              type="number"
              min={MIN_GRAMS}
              value={gramsInput}
              onChange={(e) => setGramsInput(e.target.value)}
              aria-invalid={showGramsError}
            />
            {showGramsError && (
              <p className="text-xs text-destructive">Enter at least {MIN_GRAMS} grams.</p>
            )}
          </div>

          <Button
            disabled={!selected || !gramsValid}
            onClick={() => selected && setSubmitted({ id: selected.id, grams: gramsValue })}
          >
            Look up nutrition
          </Button>
        </div>
      </Card>

      {isResultLoading && (
        <Card className="p-6">
          <Skeleton className="mb-3 h-5 w-64" />
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </Card>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Something went wrong loading nutrition data. Try again.
        </p>
      )}

      {!isResultLoading && submitted && result && <VietSearchResults result={result} />}
    </div>
  );
}
