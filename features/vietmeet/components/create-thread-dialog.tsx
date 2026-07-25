"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useUser } from "@/lib/supabase/use-user";
import { uploadForumAttachment, type UploadedAttachment } from "@/features/vietmeet/upload-attachment";
import { Button } from "@/components/ui/button";
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const create = useMutation(
    trpc.vietmeet.createThread.mutationOptions({
      onSuccess: () => {
        toast.success("Thread posted");
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
      <DialogTrigger className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">
        New thread
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new thread</DialogTitle>
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
                toast.error(err instanceof Error ? err.message : "Upload failed");
                setUploading(false);
                return;
              }
              setUploading(false);
            }
            create.mutate({ title, description: description || undefined, content, attachments });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-title">Title</Label>
            <Input id="thread-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-description">Short description — optional</Label>
            <Input
              id="thread-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-content">Content</Label>
            <Textarea
              id="thread-content"
              required
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thread-image">Attach an image — optional</Label>
            <Input
              id="thread-image"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="submit" disabled={create.isPending || uploading}>
            {uploading ? "Uploading..." : create.isPending ? "Posting..." : "Post thread"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
