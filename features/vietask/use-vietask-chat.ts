"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

/**
 * EventSource can't do POST bodies, so this parses the SSE stream manually
 * from a plain fetch() Response instead — same wire format
 * (`data: {...}\n\n`), just consumed by hand.
 */
export function useVietAskChat() {
  const trpc = useTRPC();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  // Authenticated users resume their most recent conversation; anonymous
  // users start fresh each visit (no stable identity to resume against —
  // see server/db/policies.sql's chat_sessions comment).
  const { data: latestSession } = useQuery(trpc.vietask.getLatestSession.queryOptions());

  useEffect(() => {
    if (hydratedRef.current || !latestSession) return;
    hydratedRef.current = true;
    setMessages(latestSession.messages.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
  }, [latestSession]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
      setIsStreaming(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/vietask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: trimmed }),
        });
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? ""; // last chunk may be incomplete, keep it for next read

          for (const evt of events) {
            const line = evt.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = JSON.parse(line.slice("data: ".length)) as
              | { text: string }
              | { done: true }
              | { error: string };

            if ("text" in payload) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + payload.text } : m)),
              );
            } else if ("error" in payload) {
              setError(payload.error);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reach VietAsk.");
      } finally {
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming],
  );

  return { messages, sendMessage, isStreaming, error };
}
