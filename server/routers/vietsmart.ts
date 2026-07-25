import { z } from "zod";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { libraryResources, profiles } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc/init";
import { getUploadUrl as getR2UploadUrl, getDownloadUrl as getR2DownloadUrl, deleteObject } from "@/server/storage/r2";
import { assertNotProfane } from "@/server/lib/content-moderation";
import { TRPCError } from "@trpc/server";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
];
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

async function isAdmin(ctx: { db: typeof import("@/server/db").db }, userId: string): Promise<boolean> {
  const [profile] = await ctx.db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return profile?.role === "admin";
}

export const vietsmartRouter = createTRPCRouter({
  requestUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        mime: z.enum(ALLOWED_MIME_TYPES as [string, ...string[]]),
        size: z.number().int().min(1).max(MAX_SIZE_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const storagePath = `library/${ctx.user.id}/${crypto.randomUUID()}-${input.filename}`;
      const uploadUrl = await getR2UploadUrl(storagePath, input.mime);
      return { uploadUrl, storagePath };
    }),

  createResource: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        category: z.string().max(100).optional(),
        storagePath: z.string().min(1),
        filename: z.string().min(1).max(255),
        mime: z.enum(ALLOWED_MIME_TYPES as [string, ...string[]]),
        size: z.number().int().min(1).max(MAX_SIZE_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Ownership convention matches the storage RLS pattern used elsewhere
      // (server/db/policies.sql) even though R2 access here goes through
      // our own presigned-URL endpoint, not direct client->R2 RLS.
      if (!input.storagePath.startsWith(`library/${ctx.user.id}/`)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "storagePath does not belong to you." });
      }

      assertNotProfane(input.title, "Title");
      if (input.description) assertNotProfane(input.description, "Description");

      const [resource] = await ctx.db
        .insert(libraryResources)
        .values({
          uploaderId: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? null,
          storagePath: input.storagePath,
          filename: input.filename,
          mime: input.mime,
          size: input.size,
        })
        .returning();

      return resource;
    }),

  listResources: publicProcedure
    .input(
      z.object({
        search: z.string().max(200).optional(),
        category: z.string().max(100).optional(),
        sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search?.trim()) {
        const like = `%${input.search.trim()}%`;
        conditions.push(or(ilike(libraryResources.title, like), ilike(libraryResources.description, like)));
      }
      if (input.category) {
        conditions.push(eq(libraryResources.category, input.category));
      }

      const orderBy =
        input.sort === "popular"
          ? desc(libraryResources.downloadCount)
          : input.sort === "oldest"
            ? asc(libraryResources.createdAt)
            : desc(libraryResources.createdAt);

      return ctx.db
        .select({
          id: libraryResources.id,
          title: libraryResources.title,
          description: libraryResources.description,
          category: libraryResources.category,
          filename: libraryResources.filename,
          mime: libraryResources.mime,
          size: libraryResources.size,
          downloadCount: libraryResources.downloadCount,
          createdAt: libraryResources.createdAt,
          uploaderId: libraryResources.uploaderId,
          uploaderDisplayName: profiles.displayName,
        })
        .from(libraryResources)
        .innerJoin(profiles, eq(libraryResources.uploaderId, profiles.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(orderBy)
        .limit(50);
    }),

  getCategories: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.selectDistinct({ category: libraryResources.category }).from(libraryResources);
    return rows.map((r) => r.category).filter((c): c is string => c !== null);
  }),

  getDownloadUrl: publicProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const [resource] = await ctx.db.select().from(libraryResources).where(eq(libraryResources.id, input.id)).limit(1);
    if (!resource) throw new TRPCError({ code: "NOT_FOUND" });

    const url = await getR2DownloadUrl(resource.storagePath, resource.filename);
    await ctx.db
      .update(libraryResources)
      .set({ downloadCount: resource.downloadCount + 1 })
      .where(eq(libraryResources.id, input.id));

    return { url };
  }),

  deleteResource: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const [resource] = await ctx.db.select().from(libraryResources).where(eq(libraryResources.id, input.id)).limit(1);
    if (!resource) throw new TRPCError({ code: "NOT_FOUND" });

    const admin = await isAdmin(ctx, ctx.user.id);
    if (resource.uploaderId !== ctx.user.id && !admin) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await ctx.db.delete(libraryResources).where(eq(libraryResources.id, input.id));
    await deleteObject(resource.storagePath).catch(() => {
      // DB row is gone either way; an orphaned R2 object is a cheap, safe
      // failure mode here (no cost implication beyond storage, no
      // dangling reference anywhere in the app) — not worth failing the
      // whole mutation over.
    });

    return { success: true };
  }),
});
