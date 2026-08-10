import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs, type ModelMessage, type ToolSet } from "ai";

// Provider-abstraction layer (plan §2.10, D4): the model/provider is a
// config value here, not something callers need to know about. Default is
// free-tier Gemini; a paid model (e.g. Claude) becomes a pure config swap
// later if ever needed — nothing below is Gemini-specific by contract.

const API_KEYS = (process.env.GEMINI_API_KEYS ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

if (API_KEYS.length === 0) {
  throw new Error("GEMINI_API_KEYS is not set. Copy .env.example to .env.local and fill it in.");
}

/**
 * Streams a completion, trying each configured API key in turn (the user's
 * own multi-key setup, "for fallback if ones are being timeout"). Only
 * retries with the next key if the failing key produced zero output —
 * once a key has already streamed some content to the caller, a failure
 * after that point ends the stream as-is rather than retrying, which would
 * otherwise look like the answer restarting mid-sentence under a different
 * key. That's an accepted, documented limitation, not an oversight.
 */
export async function* generateWithFallback(
  messages: ModelMessage[],
  systemPrompt: string,
  tools?: ToolSet,
): AsyncGenerator<string, void, unknown> {
  let lastError: unknown;

  for (const apiKey of API_KEYS) {
    let yieldedAny = false;
    try {
      const google = createGoogleGenerativeAI({ apiKey });
      // stopWhen controls the agentic tool loop: without it, streamText stops
      // after a single step, so a tool call would never get a chance to
      // produce a following text answer. 4 = headroom for both VietAsk tools
      // being called once each plus the final text step, not an unbounded loop.
      const result = streamText({
        model: google(MODEL_ID),
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(4),
      });

      for await (const chunk of result.textStream) {
        yieldedAny = true;
        yield chunk;
      }
      return;
    } catch (err) {
      lastError = err;
      if (yieldedAny) throw err;
      // else: this key failed before producing anything — fall through to the next one.
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All configured AI provider keys failed.");
}
