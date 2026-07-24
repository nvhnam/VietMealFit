"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useExperienceMode } from "@/features/experience-mode";

/**
 * Floating VietAsk dock (plan §1.8) — Advanced mode only. This is a Phase 0
 * placeholder: the real first-party AI integration (provider-abstracted
 * streaming SSE, replacing the paper's Chatling embed) lands in Phase 5.
 */
export function VietAskDock() {
  const { mode } = useExperienceMode();
  const [open, setOpen] = useState(false);

  if (mode !== "advanced") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <Card className="mb-2 w-80 p-4 text-sm text-muted-foreground">
          VietAsk chat isn&apos;t wired up yet — arriving in Phase 5 (first-party AI,
          replacing the original Chatling embed).
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
