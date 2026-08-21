"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Heart, Users } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useI18n } from "@/features/i18n";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateThreadDialog } from "./create-thread-dialog";

export function ThreadList() {
  const trpc = useTRPC();
  const { t } = useI18n();
  // `items` is what makes <SelectValue> render the translated label instead of
  // the raw stored value; the options render from this same map so the trigger
  // and the list cannot drift apart.
  const sortItems: Record<string, ReactNode> = {
    newest: t.vietmeet.newestFirst,
    oldest: t.vietmeet.oldestFirst,
  };
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: threads, isLoading } = useQuery(
    trpc.vietmeet.listThreads.queryOptions({ search: debouncedSearch || undefined, sort }),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        icon={Users}
        title={t.vietmeet.title}
        description={t.vietmeet.description}
        action={<CreateThreadDialog />}
      />

      <div className="flex gap-2">
        <Input
          placeholder={t.vietmeet.searchThreads}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          items={sortItems}
          value={sort}
          onValueChange={(v) => v && setSort(v as "newest" | "oldest")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(sortItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && threads?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.vietmeet.noThreadsYet(search)}</p>
      )}

      <div className="flex flex-col gap-3">
        {threads?.map((thread) => (
          <Link key={thread.id} href={`/vietmeet/${thread.id}`}>
            <Card className="cursor-pointer p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-md">
              <h2 className="font-medium">{thread.title}</h2>
              {thread.description && (
                <p className="mt-1 text-sm text-muted-foreground">{thread.description}</p>
              )}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span>{thread.authorDisplayName}</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3.5" /> {thread.commentCount}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="size-3.5" /> {thread.likeCount}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
