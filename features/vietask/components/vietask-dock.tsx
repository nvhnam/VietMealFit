"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useExperienceMode } from "@/features/experience-mode";
import { useVietAskChat } from "@/features/vietask/use-vietask-chat";
import { cn } from "@/lib/utils";

/** Floating VietAsk dock (plan §1.8) — Advanced mode only, first-party AI replacing the paper's Chatling embed. */
export function VietAskDock() {
  const { mode } = useExperienceMode();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, isStreaming, error } = useVietAskChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (mode !== "advanced") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <Card className="mb-2 flex h-96 w-80 flex-col p-0 sm:w-96">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">VietAsk</h2>
            <p className="text-xs text-muted-foreground">Ask about navigating the app or general fitness questions.</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Try: &ldquo;How do I generate a meal plan?&rdquo; or &ldquo;What should I eat before a workout?&rdquo;
              </p>
            )}
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
                </div>
              ))}
            </div>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const text = input;
              setInput("");
              void sendMessage(text);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask VietAsk..."
              disabled={isStreaming}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </Card>
      )}
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close VietAsk" : "Open VietAsk"}
      >
        {open ? <X /> : <MessageCircle />}
      </Button>
    </div>
  );
}
