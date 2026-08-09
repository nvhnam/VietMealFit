import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/server/db";
import { chatSessions, chatMessages, profiles } from "@/server/db/schema";
import { createClient } from "@/lib/supabase/server";
import { generateWithFallback } from "@/server/ai/provider";
import { buildVietAskSystemPrompt, buildUserProfileContext } from "@/server/ai/system-prompt";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  language: z.enum(["en", "vi"]).default("en"),
});

function sseEvent(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
  }
  const { sessionId, message, language } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetched fresh on every request (not cached on the session) so an edit to
  // the user's profile takes effect on their very next message.
  const [profile] = user
    ? await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
    : [];
  const userContext = buildUserProfileContext(profile);

  const [existingSession] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);

  if (existingSession) {
    // Session IDs are random UUIDs (practically unguessable), but this is
    // still a cheap, correct ownership check — ctx.db-equivalent direct
    // access here bypasses RLS, same as everywhere else in this app.
    const belongsToSomeoneElse =
      existingSession.userId !== null && existingSession.userId !== (user?.id ?? null);
    if (belongsToSomeoneElse) {
      return new Response(JSON.stringify({ error: "Session not found." }), { status: 404 });
    }
  } else {
    await db.insert(chatSessions).values({ id: sessionId, userId: user?.id ?? null });
  }

  await db.insert(chatMessages).values({ sessionId, role: "user", content: message });

  // Full history, not just this message — mitigates the paper's flagged
  // weakness (Chatling was weak on cross-turn context) since the model now
  // sees the whole conversation, not just the latest turn in isolation.
  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  const modelMessages: ModelMessage[] = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        for await (const chunk of generateWithFallback(modelMessages, buildVietAskSystemPrompt(language, userContext))) {
          fullText += chunk;
          controller.enqueue(sseEvent({ text: chunk }));
        }
        controller.enqueue(sseEvent({ done: true }));
      } catch (err) {
        controller.enqueue(sseEvent({ error: err instanceof Error ? err.message : "Generation failed." }));
      } finally {
        if (fullText.trim()) {
          await db.insert(chatMessages).values({ sessionId, role: "assistant", content: fullText });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
