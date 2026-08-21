"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useExperienceMode } from "@/features/experience-mode";
import { useI18n } from "@/features/i18n";
import { useVietAskChat } from "@/features/vietask/use-vietask-chat";
import { cn } from "@/lib/utils";

/** Floating VietAsk dock (plan §1.8) — Advanced mode only, first-party AI replacing the paper's Chatling embed. */
export function VietAskDock() {
  const { mode } = useExperienceMode();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, isStreaming, error, clearHistory, isClearing } = useVietAskChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Two-step rather than a modal: deleting the whole conversation is
  // irreversible, but a dialog over a 320px dock is heavier than the action
  // warrants. Reset whenever the dock closes so it never reopens mid-confirm.
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (mode !== "advanced") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <Card className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 mb-2 flex h-96 w-80 flex-col p-0 shadow-xl duration-200 sm:w-96">
          <div className="flex items-start justify-between gap-2 rounded-t-xl border-b bg-primary/5 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">{t.vietask.title}</h2>
              <p className="text-xs text-muted-foreground">{t.vietask.subtitle}</p>
            </div>
            {messages.length > 0 &&
              (confirmingClear ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isClearing}
                    onClick={() => {
                      setConfirmingClear(false);
                      clearHistory();
                      toast.success(t.vietask.historyCleared);
                    }}
                  >
                    {t.vietask.clearConfirm}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingClear(false)}>
                    {t.vietask.clearCancel}
                  </Button>
                </div>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  disabled={isStreaming}
                  onClick={() => setConfirmingClear(true)}
                  aria-label={t.vietask.clearHistory}
                  title={t.vietask.clearHistory}
                >
                  <Trash2 className="size-4" />
                </Button>
              ))}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.vietask.exampleQuestions}</p>
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
              placeholder={t.vietask.inputPlaceholder}
              disabled={isStreaming}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} aria-label={t.vietask.send}>
              <Send className="size-4" />
            </Button>
          </form>
        </Card>
      )}
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={() =>
          setOpen((v) => {
            if (v) setConfirmingClear(false);
            return !v;
          })
        }
        aria-label={open ? t.vietask.close : t.vietask.open}
      >
        {open ? <X /> : <MessageCircle />}
      </Button>
    </div>
  );
}
