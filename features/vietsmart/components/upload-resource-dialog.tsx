"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useUser } from "@/lib/supabase/use-user";
import { useI18n } from "@/features/i18n";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
];

export function UploadResourceDialog() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const requestUploadUrl = useMutation(trpc.vietsmart.requestUploadUrl.mutationOptions());
  const createResource = useMutation(
    trpc.vietsmart.createResource.mutationOptions({
      onSuccess: () => {
        toast.success(t.vietsmart.resourceUploaded);
        queryClient.invalidateQueries({ queryKey: trpc.vietsmart.listResources.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.vietsmart.getCategories.queryKey() });
        setOpen(false);
        setTitle("");
        setDescription("");
        setCategory("");
        setFile(null);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  if (!user) return null;

  const isMimeAllowed = file && ALLOWED_MIME_TYPES.includes(file.type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ size: "sm" })}>{t.vietsmart.uploadResource}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.vietsmart.uploadFitnessResource}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file || !isMimeAllowed) {
              toast.error(t.vietsmart.chooseFileError);
              return;
            }
            setIsUploading(true);
            try {
              const { uploadUrl, storagePath } = await requestUploadUrl.mutateAsync({
                filename: file.name,
                mime: file.type,
                size: file.size,
              });
              const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
              if (!putRes.ok) throw new Error(t.vietsmart.uploadToStorageFailed);

              await createResource.mutateAsync({
                title,
                description: description || undefined,
                category: category || undefined,
                storagePath,
                filename: file.name,
                mime: file.type,
                size: file.size,
              });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : t.vietsmart.uploadFailed);
            } finally {
              setIsUploading(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-title">{t.vietsmart.titleLabel}</Label>
            <Input id="resource-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-description">{t.vietsmart.descriptionOptional}</Label>
            <Textarea
              id="resource-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-category">{t.vietsmart.categoryOptional}</Label>
            <Input
              id="resource-category"
              placeholder={t.vietsmart.categoryPlaceholder}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-file">{t.vietsmart.fileLabel}</Label>
            <Input
              id="resource-file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.txt,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && !isMimeAllowed && (
              <p className="text-xs text-destructive">{t.vietsmart.unsupportedFileType}</p>
            )}
          </div>
          <Button type="submit" disabled={isUploading || createResource.isPending}>
            {isUploading ? t.vietsmart.uploading : t.vietsmart.upload}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
