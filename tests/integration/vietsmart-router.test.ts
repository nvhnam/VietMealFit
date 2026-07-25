// Uses real presigned R2 uploads/downloads — actual bytes go over the wire
// to Cloudflare R2, not mocked, matching how this router has always been
// verified. Requires R2 credentials in .env.local.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import { profiles, libraryResources } from "@/server/db/schema";
import { createTestUser, deleteTestUser } from "./helpers";

const FILE_CONTENT = "%PDF-1.4 fake pdf content for testing";

describe("vietsmart router", () => {
  let user: User;
  let user2: User;
  let resourceId: string | undefined;
  let downloadUrl: string;

  beforeAll(async () => {
    user = await createTestUser("vietsmart");
    user2 = await createTestUser("vietsmart2");
  });

  afterAll(async () => {
    if (resourceId) await db.delete(libraryResources).where(eq(libraryResources.id, resourceId)).catch(() => {});
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await deleteTestUser(user.id);
    await deleteTestUser(user2.id);
    // See profiles-router.test.ts for why: closes this file's connection pool.
    await db.$client.end({ timeout: 5 });
  });

  it("blocks an anonymous requestUploadUrl", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    await expect(
      anonCaller.vietsmart.requestUploadUrl({ filename: "x.pdf", mime: "application/pdf", size: 100 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("uploads real bytes to R2 via a presigned PUT URL", async () => {
    const caller = appRouter.createCaller({ db, user });
    const { uploadUrl, storagePath } = await caller.vietsmart.requestUploadUrl({
      filename: "test-guide.pdf",
      mime: "application/pdf",
      size: FILE_CONTENT.length,
    });

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: FILE_CONTENT,
    });
    expect(putRes.status).toBe(200);

    // Reject a storagePath outside the caller's own namespace.
    await expect(
      caller.vietsmart.createResource({
        title: "Hijack",
        storagePath: "library/00000000-0000-0000-0000-000000000000/x.pdf",
        filename: "x.pdf",
        mime: "application/pdf",
        size: 100,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const resource = await caller.vietsmart.createResource({
      title: `Test Fitness Guide ${Date.now()}`,
      description: "A test resource",
      category: "Guides",
      storagePath,
      filename: "test-guide.pdf",
      mime: "application/pdf",
      size: FILE_CONTENT.length,
    });
    resourceId = resource.id;
    expect(resource.id).toBeTruthy();
  });

  it("is listable anonymously with downloadCount starting at 0", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    const list = await anonCaller.vietsmart.listResources({ sort: "newest" });
    const listed = list.find((r) => r.id === resourceId);
    expect(listed?.downloadCount).toBe(0);
  });

  it("downloads real bytes matching what was uploaded, and increments downloadCount", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    const { url } = await anonCaller.vietsmart.getDownloadUrl({ id: resourceId! });
    downloadUrl = url;

    const getRes = await fetch(downloadUrl);
    const downloadedText = await getRes.text();
    expect(getRes.status).toBe(200);
    expect(downloadedText).toBe(FILE_CONTENT);

    const listAfter = await anonCaller.vietsmart.listResources({ sort: "newest" });
    const listedAfter = listAfter.find((r) => r.id === resourceId);
    expect(listedAfter?.downloadCount).toBe(1);
  });

  it("is findable by search and its category is listed", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    const searchResults = await anonCaller.vietsmart.listResources({ search: "Test Fitness Guide", sort: "newest" });
    expect(searchResults.length).toBeGreaterThan(0);

    const categories = await anonCaller.vietsmart.getCategories();
    expect(categories).toContain("Guides");
  });

  it("rejects a different user deleting this resource", async () => {
    const caller2 = appRouter.createCaller({ db, user: user2 });
    await expect(caller2.vietsmart.deleteResource({ id: resourceId! })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("owner delete removes the DB row and the underlying R2 object", async () => {
    const caller = appRouter.createCaller({ db, user });
    await caller.vietsmart.deleteResource({ id: resourceId! });

    const anonCaller = appRouter.createCaller({ db, user: null });
    const afterDelete = await anonCaller.vietsmart.listResources({ sort: "newest" });
    expect(afterDelete.some((r) => r.id === resourceId)).toBe(false);

    const getAfterDelete = await fetch(downloadUrl);
    expect(getAfterDelete.status).not.toBe(200);
    resourceId = undefined;
  });
});
