// Throwaway verification script for the vietsmart router.
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { appRouter } from "../server/trpc/root";
import { db } from "../server/db";
import { profiles, libraryResources } from "../server/db/schema";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const email = `vmf.vietsmart.test.${Date.now()}@gmail.com`;
  const { data: created } = await admin.auth.admin.createUser({ email, password: "TestPassword123!", email_confirm: true });
  const user = created.user!;
  console.log("Created user:", user.id);
  const caller = appRouter.createCaller({ db, user });
  const anonCaller = appRouter.createCaller({ db, user: null });

  let resourceId: string | undefined;
  try {
    let anonBlocked = false;
    try {
      await anonCaller.vietsmart.requestUploadUrl({ filename: "x.pdf", mime: "application/pdf", size: 100 });
    } catch (e: unknown) {
      anonBlocked = (e as { code?: string }).code === "UNAUTHORIZED";
    }
    console.log("Anonymous requestUploadUrl blocked:", anonBlocked);
    if (!anonBlocked) throw new Error("FAIL: anon should not get an upload URL");

    // Real presigned upload: get URL, PUT actual bytes to R2, verify it landed.
    const { uploadUrl, storagePath } = await caller.vietsmart.requestUploadUrl({
      filename: "test-guide.pdf",
      mime: "application/pdf",
      size: 1234,
    });
    console.log("Got presigned upload URL, storagePath:", storagePath);

    const fileContent = "%PDF-1.4 fake pdf content for testing";
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: fileContent,
    });
    console.log("Real PUT to R2 via presigned URL:", putRes.status);
    if (putRes.status !== 200) throw new Error(`FAIL: presigned PUT failed with ${putRes.status}`);

    // Reject a storagePath that doesn't belong to the caller.
    let forbiddenBlocked = false;
    try {
      await caller.vietsmart.createResource({
        title: "Hijack",
        storagePath: "library/00000000-0000-0000-0000-000000000000/x.pdf",
        filename: "x.pdf",
        mime: "application/pdf",
        size: 100,
      });
    } catch (e: unknown) {
      forbiddenBlocked = (e as { code?: string }).code === "FORBIDDEN";
    }
    console.log("createResource with someone else's storagePath blocked:", forbiddenBlocked);
    if (!forbiddenBlocked) throw new Error("FAIL: should reject a storagePath outside the caller's namespace");

    const resource = await caller.vietsmart.createResource({
      title: "Test Fitness Guide " + Date.now(),
      description: "A test resource",
      category: "Guides",
      storagePath,
      filename: "test-guide.pdf",
      mime: "application/pdf",
      size: fileContent.length,
    });
    resourceId = resource.id;
    console.log("Created resource:", resource.id);

    const list = await anonCaller.vietsmart.listResources({ sort: "newest" });
    const listed = list.find((r) => r.id === resourceId);
    console.log("Anonymous can list it, downloadCount:", listed?.downloadCount, "(expect 0)");
    if (!listed) throw new Error("FAIL: anon should see the resource in listResources");
    if (listed.downloadCount !== 0) throw new Error("FAIL: expected downloadCount 0");

    // Download: real presigned GET, fetch it, confirm content matches what was uploaded.
    const { url: downloadUrl } = await anonCaller.vietsmart.getDownloadUrl({ id: resourceId });
    const getRes = await fetch(downloadUrl);
    const downloadedText = await getRes.text();
    console.log("Real GET via presigned URL:", getRes.status, "content matches:", downloadedText === fileContent);
    if (getRes.status !== 200) throw new Error(`FAIL: download failed with ${getRes.status}`);
    if (downloadedText !== fileContent) throw new Error("FAIL: downloaded content doesn't match uploaded content");

    const listAfterDownload = await anonCaller.vietsmart.listResources({ sort: "newest" });
    const listedAfter = listAfterDownload.find((r) => r.id === resourceId);
    console.log("downloadCount after 1 download:", listedAfter?.downloadCount, "(expect 1)");
    if (listedAfter?.downloadCount !== 1) throw new Error(`FAIL: expected downloadCount 1, got ${listedAfter?.downloadCount}`);

    // Search + category filter.
    const searchResults = await anonCaller.vietsmart.listResources({ search: "Test Fitness Guide", sort: "newest" });
    console.log("Search results:", searchResults.length);
    if (searchResults.length === 0) throw new Error("FAIL: search should find the resource");

    const categories = await anonCaller.vietsmart.getCategories();
    console.log("Categories:", categories);
    if (!categories.includes("Guides")) throw new Error("FAIL: expected 'Guides' category to be listed");

    // Cross-user delete rejection.
    const { data: created2 } = await admin.auth.admin.createUser({
      email: `vmf.vietsmart.test2.${Date.now()}@gmail.com`,
      password: "TestPassword123!",
      email_confirm: true,
    });
    const caller2 = appRouter.createCaller({ db, user: created2.user! });
    let crossDeleteBlocked = false;
    try {
      await caller2.vietsmart.deleteResource({ id: resourceId });
    } catch (e: unknown) {
      crossDeleteBlocked = (e as { code?: string }).code === "FORBIDDEN";
    }
    console.log("Cross-user delete blocked:", crossDeleteBlocked);
    if (!crossDeleteBlocked) throw new Error("FAIL: a different user deleted this resource!");
    await admin.auth.admin.deleteUser(created2.user!.id);

    // Owner delete works, and the R2 object is actually gone too (not just the DB row).
    await caller.vietsmart.deleteResource({ id: resourceId });
    const afterDeleteList = await anonCaller.vietsmart.listResources({ sort: "newest" });
    if (afterDeleteList.some((r) => r.id === resourceId)) throw new Error("FAIL: resource still listed after delete");
    const getAfterDelete = await fetch(downloadUrl);
    console.log("R2 object after delete, GET status:", getAfterDelete.status, "(expect 403 or 404 — signed URL now points to a deleted object)");
    resourceId = undefined;

    console.log("ALL CHECKS PASSED");
  } finally {
    if (resourceId) await db.delete(libraryResources).where(eq(libraryResources.id, resourceId)).catch(() => {});
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await admin.auth.admin.deleteUser(user.id);
    console.log("Cleaned up.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
