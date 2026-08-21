"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

/**
 * EventSource can't do POST bodies, so this parses the SSE stream manually
 * from a plain fetch() Response instead — same wire format
 * (`data: {...}\n\n`), just consumed by hand.
 */
export function useVietAskChat() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { language, t } = useI18n();
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
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

  const clearMutation = useMutation(
    trpc.vietask.clearHistory.mutationOptions({
      onSuccess: () => {
        setMessages([]);
        setError(null);
        // A cleared conversation is a new conversation: the next message must
        // not land back in the session that was just deleted.
        setSessionId(crypto.randomUUID());
        queryClient.invalidateQueries({ queryKey: trpc.vietask.getLatestSession.queryKey() });
      },
      onError: (err) => setError(err.message),
    }),
  );

  const clearHistory = useCallback(() => {
    if (clearMutation.isPending) return;
    // Nothing will be left on the server to resume from, and the dock stays
    // mounted across the delete, so the hydration effect must be blocked from
    // re-running. Written here in the event handler rather than in the
    // mutation's onSuccess: a ref cannot be touched from a callback built
    // during render.
    hydratedRef.current = true;
    clearMutation.mutate({ sessionId });
  }, [clearMutation, sessionId]);

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
          body: JSON.stringify({ sessionId, message: trimmed, language }),
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
        setError(err instanceof Error ? err.message : t.vietask.errorFailedToReach);
      } finally {
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, language, t],
  );

  return {
    messages,
    sendMessage,
    isStreaming,
    error,
    clearHistory,
    isClearing: clearMutation.isPending,
  };
}
