"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useUser } from "@/lib/supabase/use-user";
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
        toast.success("Resource uploaded");
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
      <DialogTrigger className={buttonVariants({ size: "sm" })}>Upload resource</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a fitness resource</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file || !isMimeAllowed) {
              toast.error("Choose a PDF, Word doc, text file, or image.");
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
              if (!putRes.ok) throw new Error("Upload to storage failed.");

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
              toast.error(err instanceof Error ? err.message : "Upload failed.");
            } finally {
              setIsUploading(false);
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-title">Title</Label>
            <Input id="resource-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-description">Description — optional</Label>
            <Textarea
              id="resource-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-category">Category — optional</Label>
            <Input
              id="resource-category"
              placeholder="Guides, Articles, Workout Plans, ..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resource-file">File (PDF, Word, text, or image — max 25MB)</Label>
            <Input
              id="resource-file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.txt,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && !isMimeAllowed && (
              <p className="text-xs text-destructive">This file type isn&apos;t supported.</p>
            )}
          </div>
          <Button type="submit" disabled={isUploading || createResource.isPending}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
