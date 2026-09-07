"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, X, Send, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useExperienceMode } from "@/features/experience-mode";
import { useI18n } from "@/features/i18n";
import { useVietAskChat } from "@/features/vietask/use-vietask-chat";
import { parseMessageSegments } from "@/features/vietask/format-message";
import { cn } from "@/lib/utils";

/** Floating VietAsk dock (plan §1.8) — Advanced mode only, first-party AI replacing the paper's Chatling embed. */
export function VietAskDock() {
  const { mode } = useExperienceMode();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, isStreaming, error, clearHistory, isClearing } = useVietAskChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Two-step rather than a modal: deleting the whole conversation is
  // irreversible, but a dialog over a 320px dock is heavier than the action
  // warrants. Reset whenever the dock closes so it never reopens mid-confirm.
  const [confirmingClear, setConfirmingClear] = useState(false);

  // `expanded` is a dependency because switching size remounts the scroll
  // container at a new tree position, which resets its scrollTop — without
  // this the view would jump to the top of a long conversation on toggle.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, expanded]);

  // Escape collapses before it closes: with the dock hidden behind the
  // expanded panel, closing outright would be a bigger jump than intended.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, expanded]);

  if (mode !== "advanced") return null;

  const panel = (
    <>
      <div className="flex items-start justify-between gap-2 rounded-t-xl border-b bg-primary/5 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{t.vietask.title}</h2>
          <p className="text-xs text-muted-foreground">{t.vietask.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? t.vietask.collapse : t.vietask.expand}
            title={expanded ? t.vietask.collapse : t.vietask.expand}
            aria-pressed={expanded}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={() => {
              setOpen(false);
              setExpanded(false);
              setConfirmingClear(false);
            }}
            aria-label={t.vietask.close}
            title={t.vietask.close}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {/* Capped in the expanded panel: at full width a bubble would run to
            ~760px, well past a comfortable measure for reading (and for a
            figure in print). The dock is already narrower than the cap.
            justify-end + min-h-full anchors a short conversation to the bottom
            the way a chat is expected to read, instead of stranding two
            messages at the top of an 800px void; it still scrolls normally
            once the thread outgrows the panel. */}
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-end">
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
                {m.content
                  ? parseMessageSegments(m.content).map((seg, i) =>
                      seg.bold ? (
                        <strong key={i} className="font-semibold">
                          {seg.text}
                        </strong>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )
                  : isStreaming && m.role === "assistant"
                    ? "…"
                    : ""}
              </div>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input;
          setInput("");
          void sendMessage(text);
        }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.vietask.inputPlaceholder}
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isStreaming || !input.trim()}
            aria-label={t.vietask.send}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </>
  );

  return (
    <>
      {open && expanded && (
        <>
          {/* Rendered outside the dock's positioned wrapper rather than inside
              it: a `fixed` child would still escape to the viewport, but only
              while no ancestor creates a containing block (a transform or
              filter anywhere above would silently break it). */}
          <div
            className="animate-in fade-in-0 fixed inset-0 z-40 bg-foreground/20 duration-200"
            onClick={() => setExpanded(false)}
            aria-hidden="true"
          />
          <Card
            role="dialog"
            aria-modal="false"
            aria-label={t.vietask.title}
            className="animate-in fade-in-0 zoom-in-95 fixed inset-3 z-50 mx-auto flex max-w-5xl flex-col p-0 shadow-2xl duration-200 sm:inset-6 md:inset-y-10"
          >
            {panel}
          </Card>
        </>
      )}

      <div className="fixed bottom-4 right-4 z-50">
        {open && !expanded && (
          <Card className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 mb-2 flex h-96 w-80 max-w-[calc(100vw-2rem)] flex-col p-0 shadow-xl duration-200 sm:w-96">
            {panel}
          </Card>
        )}
        {/* Hidden while expanded — the panel covers this corner, and a floating
            button overlapping it would land in any screenshot of the dialog. */}
        {!expanded && (
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
        )}
      </div>
    </>
  );
}
