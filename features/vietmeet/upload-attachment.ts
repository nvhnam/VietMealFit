"use client";

import { createClient } from "@/lib/supabase/client";

export type UploadedAttachment = {
  storagePath: string;
  filename: string;
  mime: string;
  size: number;
};

/**
 * Uploads directly from the browser to Supabase Storage (not proxied through
 * our server) using the signed-in user's own session — the storage RLS
 * policy (server/db/policies.sql) requires the path to be namespaced under
 * `forum/{auth.uid()}/...`, which is what enforces ownership here.
 */
export async function uploadForumAttachment(file: File, userId: string): Promise<UploadedAttachment> {
  const supabase = createClient();
  const storagePath = `forum/${userId}/${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage.from("forum-attachments").upload(storagePath, file, {
    contentType: file.type,
  });
  if (error) throw error;

  return { storagePath, filename: file.name, mime: file.type, size: file.size };
}

export function getForumAttachmentUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from("forum-attachments").getPublicUrl(storagePath).data.publicUrl;
}
