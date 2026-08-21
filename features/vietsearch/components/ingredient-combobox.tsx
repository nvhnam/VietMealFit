"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";
import { foodDisplayNames } from "@/features/vietsearch/display-name";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type IngredientOption = {
  id: string;
  nameVi: string;
  nameEn: string | null;
  category: string | null;
};

export function IngredientCombobox({
  value,
  onSelect,
  category,
}: {
  value: IngredientOption | null;
  onSelect: (item: IngredientOption) => void;
  category?: string;
}) {
  const trpc = useTRPC();
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const { data: results, isFetching } = useQuery(
    trpc.vietsearch.search.queryOptions(
      open ? { query: debouncedQuery || undefined, category, language } : skipToken,
    ),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm",
          "hover:bg-muted/50 cursor-pointer transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
        )}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {value
            ? foodDisplayNames(value, language).primary
            : t.vietsearch.selectIngredientPlaceholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        {/* shouldFilter=false: results come from the server (vietsearch.search),
            not cmdk's built-in client-side fuzzy filter over static children. */}
        <Command shouldFilter={false} className="rounded-lg">
          <CommandInput
            placeholder={t.vietsearch.searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isFetching && (
              <div className="py-6 text-center text-sm text-muted-foreground">{t.vietsearch.searchingLabel}</div>
            )}
            {!isFetching && results?.length === 0 && (
              <CommandEmpty>{t.vietsearch.noIngredientsFound(query)}</CommandEmpty>
            )}
            {!isFetching && results && results.length > 0 && (
              <CommandGroup>
                {results.map((item) => {
                  const { primary, secondary } = foodDisplayNames(item, language);
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onSelect(item);
                        setOpen(false);
                      }}
                      data-checked={value?.id === item.id}
                    >
                      <div className="flex flex-col">
                        <span>{primary}</span>
                        {secondary && (
                          <span className="text-xs text-muted-foreground">{secondary}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
