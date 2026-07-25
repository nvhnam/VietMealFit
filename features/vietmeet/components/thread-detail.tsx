"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useUser } from "@/lib/supabase/use-user";
import { getForumAttachmentUrl } from "@/features/vietmeet/upload-attachment";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ThreadDetail({ threadId }: { threadId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [commentText, setCommentText] = useState("");

  const { data: thread, isLoading } = useQuery(trpc.vietmeet.getThread.queryOptions({ id: threadId }));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.vietmeet.getThread.queryKey({ id: threadId }) });

  const toggleLike = useMutation(
    trpc.vietmeet.toggleThreadLike.mutationOptions({ onSuccess: invalidate }),
  );
  const addComment = useMutation(
    trpc.vietmeet.createComment.mutationOptions({
      onSuccess: () => {
        setCommentText("");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const deleteThread = useMutation(
    trpc.vietmeet.deleteThread.mutationOptions({
      onSuccess: () => {
        toast.success("Thread deleted");
        queryClient.invalidateQueries({ queryKey: trpc.vietmeet.listThreads.queryKey() });
        router.push("/vietmeet");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const deleteComment = useMutation(
    trpc.vietmeet.deleteComment.mutationOptions({ onSuccess: invalidate }),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!thread) {
    return <p className="text-center text-sm text-muted-foreground">Thread not found.</p>;
  }

  const canModifyThread = user && (user.id === thread.author.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href="/vietmeet"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to VietMeet
      </Link>
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{thread.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">by {thread.author.displayName}</p>
          </div>
          {canModifyThread && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete thread"
              onClick={() => deleteThread.mutate({ id: thread.id })}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm">{thread.content}</p>

        {thread.attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {thread.attachments.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded images from Supabase Storage, not a known-dimension local/remote asset
              <img
                key={a.id}
                src={getForumAttachmentUrl(a.storagePath)}
                alt={a.filename}
                className="max-h-64 rounded-md border object-contain"
              />
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={!user}
          onClick={() => toggleLike.mutate({ threadId: thread.id })}
        >
          <Heart className={cn("size-4", thread.likedByMe && "fill-current text-destructive")} />
          {thread.likeCount}
        </Button>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{thread.comments.length} comments</h2>
        {thread.comments.map((comment) => {
          const canModifyComment = user && user.id === comment.author.id;
          return (
            <Card key={comment.id} className="p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-muted-foreground">{comment.author.displayName}</p>
                {canModifyComment && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete comment"
                    onClick={() => deleteComment.mutate({ id: comment.id })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
              {comment.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {comment.attachments.map((a) => (
                    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded images from Supabase Storage
                    <img
                      key={a.id}
                      src={getForumAttachmentUrl(a.storagePath)}
                      alt={a.filename}
                      className="max-h-40 rounded-md border object-contain"
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {user ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!commentText.trim()) return;
            addComment.mutate({ threadId: thread.id, content: commentText });
          }}
        >
          <Textarea
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
          />
          <Button type="submit" disabled={addComment.isPending || !commentText.trim()} className="self-end">
            {addComment.isPending ? "Posting..." : "Comment"}
          </Button>
        </form>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Sign in to comment.</p>
      )}
    </div>
  );
}
