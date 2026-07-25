"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Library, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useUser } from "@/lib/supabase/use-user";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadResourceDialog } from "./upload-resource-dialog";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Sort = "newest" | "oldest" | "popular";

export function ResourceList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<Sort>("newest");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: categories } = useQuery(trpc.vietsmart.getCategories.queryOptions());
  const { data: resources, isLoading } = useQuery(
    trpc.vietsmart.listResources.queryOptions({ search: debouncedSearch || undefined, category, sort }),
  );

  const getDownloadUrl = useMutation(trpc.vietsmart.getDownloadUrl.mutationOptions());
  const deleteResource = useMutation(
    trpc.vietsmart.deleteResource.mutationOptions({
      onSuccess: () => {
        toast.success("Resource deleted");
        queryClient.invalidateQueries({ queryKey: trpc.vietsmart.listResources.queryKey() });
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        icon={Library}
        title="VietSmart"
        description="A shared library of fitness and nutrition resources — uploaded once, available to everyone."
        action={<UploadResourceDialog />}
      />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search resources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          value={category ?? "__all__"}
          onValueChange={(v) => v && setCategory(v === "__all__" ? undefined : v)}
        >
          <SelectTrigger className="w-44">
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
        <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="popular">Most downloaded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && resources?.length === 0 && (
        <p className="text-sm text-muted-foreground">No resources found. Be the first to upload one.</p>
      )}

      <div className="flex flex-col gap-3">
        {resources?.map((r) => (
          <Card key={r.id} className="flex items-start gap-3 p-4 transition-shadow duration-200 hover:shadow-md">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-medium">{r.title}</h2>
                {r.category && <Badge variant="secondary">{r.category}</Badge>}
              </div>
              {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {r.uploaderDisplayName} · {formatBytes(r.size)} · {r.downloadCount} downloads
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="sm"
                aria-label={`Download ${r.title}`}
                disabled={getDownloadUrl.isPending}
                onClick={async () => {
                  const { url } = await getDownloadUrl.mutateAsync({ id: r.id });
                  window.location.href = url;
                  queryClient.invalidateQueries({ queryKey: trpc.vietsmart.listResources.queryKey() });
                }}
              >
                <Download className="size-4" />
              </Button>
              {user?.id === r.uploaderId && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteResource.mutate({ id: r.id })}
                  aria-label="Delete resource"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
