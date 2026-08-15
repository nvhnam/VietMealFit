"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useUser } from "@/lib/supabase/use-user";
import { useI18n } from "@/features/i18n";
import { uploadForumAttachment, type UploadedAttachment } from "@/features/vietmeet/upload-attachment";
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

export function CreateThreadDialog() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const create = useMutation(
    trpc.vietmeet.createThread.mutationOptions({
      onSuccess: () => {
        toast.success(t.vietmeet.threadPosted);
        queryClient.invalidateQueries({ queryKey: trpc.vietmeet.listThreads.queryKey() });
        setOpen(false);
        setTitle("");
        setDescription("");
        setContent("");
        setFile(null);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ size: "sm" })}>{t.vietmeet.newThread}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.vietmeet.startNewThread}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            let attachments: UploadedAttachment[] = [];
            if (file) {
              setUploading(true);
              try {
                attachments = [await uploadForumAttachment(file, user.id)];
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t.vietmeet.uploadFailed);
                setUploading(false);
                return;
              }
              setUploading(false);
            }
            create.mutate({ title, description: description || undefined, content, attachments });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-title">{t.vietmeet.titleLabel}</Label>
            <Input id="thread-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-description">{t.vietmeet.shortDescriptionOptional}</Label>
            <Input
              id="thread-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-content">{t.vietmeet.content}</Label>
            <Textarea
              id="thread-content"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-image">{t.vietmeet.attachImageOptional}</Label>
            <Input
              id="thread-image"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" disabled={create.isPending || uploading}>
            {uploading ? t.vietmeet.uploading : create.isPending ? t.vietmeet.posting : t.vietmeet.postThread}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
