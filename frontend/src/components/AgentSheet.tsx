"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, X, Sparkles } from "lucide-react";
import AgentChat from "./agent/AgentChat";
import { cn } from "@/lib/utils";

/**
 * Global floating agent button + slide-over panel. Rendered from the root
 * layout so every page has it. Hidden on /agent because the dedicated page
 * already shows the chat.
 */
export default function AgentSheet() {
  const pathname = usePathname();
  // openedAt = pathname where the sheet was opened. If the user navigates to
  // a different route, `open` evaluates to false without a setState-in-effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;

  const openSheet = () => setOpenedAt(pathname);
  const closeSheet = () => setOpenedAt(null);

  // Close on Escape — external-system subscription, allowed by react-hooks rule.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Don't show on the dedicated /agent page
  if (pathname === "/agent") return null;

  return (
    <>
      {!open && (
        <button
          onClick={openSheet}
          className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-cyan-900/40 transition-all hover:bg-cyan-500 hover:shadow-xl"
          aria-label="Ask the agent"
        >
          <div className="relative">
            <Bot className="h-4 w-4" />
            <Sparkles className="absolute -right-1 -top-1 h-2.5 w-2.5 text-amber-200" />
          </div>
          <span className="hidden sm:inline">Ask the agent</span>
        </button>
      )}

      <div
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-50 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          onClick={closeSheet}
        />
        <div
          className={cn(
            "absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-slate-950 p-4 shadow-2xl transition-transform",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between pb-2">
            <div className="text-xs uppercase tracking-wider text-slate-500">AI Agent</div>
            <button
              onClick={closeSheet}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AgentChat compact />
          </div>
        </div>
      </div>
    </>
  );
}
