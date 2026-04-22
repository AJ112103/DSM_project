"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Send,
  Loader2,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCw,
} from "lucide-react";

import { fetchAPI, streamAPI, postAPI } from "@/lib/api";
import {
  AgentEvent,
  AgentStatus,
  ChatMessage,
  MessagePart,
  ToolPart,
  newSessionId,
} from "@/lib/agent-shared";
import { cn } from "@/lib/utils";
import ToolPartBlock from "./ToolPartBlock";

interface AgentChatProps {
  /** Optional seed prompts shown when the conversation is empty. */
  suggestedPrompts?: string[];
  /** Force a smaller, denser variant for the floating sheet. */
  compact?: boolean;
  /** Called after the first user message — host can close the empty state etc. */
  onFirstMessage?: () => void;
  /** Optional title override. */
  title?: string;
  /** Optional subtitle override. */
  subtitle?: string;
}

const DEFAULT_PROMPTS = [
  "What was the average WACMR in 2023 and how did it compare to the repo rate?",
  "What would happen to WACMR if the RBI cut the repo rate by 50 basis points?",
  "Plot WACMR and Repo Rate since 2018 — highlight the COVID break",
  "Which regime had higher volatility, and why?",
];

export default function AgentChat({
  suggestedPrompts = DEFAULT_PROMPTS,
  compact = false,
  onFirstMessage,
  title = "WACMR Agent",
  subtitle = "Gemini 2.5 Flash with function-calling over the dataset, model, and SHAP explainer",
}: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSessionId(newSessionId());
  }, []);

  const { data: agentStatus, refetch: refetchStatus } = useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: () =>
      fetchAPI("/api/agent/status").catch(() => ({
        configured: false,
        message: "Could not reach backend",
      })),
    retry: false,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const resetConversation = async () => {
    if (!sessionId) return;
    try {
      await postAPI("/api/agent/reset", { session_id: sessionId });
    } catch {
      // ignore reset failure; always clear locally
    }
    setMessages([]);
    setSessionId(newSessionId());
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming || !sessionId) return;

    if (messages.length === 0) onFirstMessage?.();

    const userMessage: ChatMessage = {
      role: "user",
      parts: [{ kind: "text", content: text.trim() }],
      timestamp: new Date(),
    };
    const assistantSeed: ChatMessage = {
      role: "assistant",
      parts: [],
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage, assistantSeed]);
    setInput("");
    setIsStreaming(true);

    const mutateAssistant = (fn: (parts: MessagePart[]) => MessagePart[]) => {
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx < 0 || next[idx].role !== "assistant") return prev;
        next[idx] = { ...next[idx], parts: fn(next[idx].parts) };
        return next;
      });
    };

    const handleEvent = (ev: AgentEvent) => {
      if (ev.type === "text") {
        mutateAssistant((parts) => {
          const last = parts[parts.length - 1];
          if (last && last.kind === "text") {
            return [
              ...parts.slice(0, -1),
              { kind: "text", content: last.content + ev.content },
            ];
          }
          return [...parts, { kind: "text", content: ev.content }];
        });
      } else if (ev.type === "tool_call") {
        mutateAssistant((parts) => [
          ...parts,
          {
            kind: "tool",
            id: `${ev.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: ev.name,
            args: ev.args,
          },
        ]);
      } else if (ev.type === "tool_result") {
        mutateAssistant((parts) => {
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            if (p.kind === "tool" && p.name === ev.name && p.result == null && !p.error) {
              const updated: ToolPart = { ...p, result: ev.result };
              return [...parts.slice(0, i), updated, ...parts.slice(i + 1)];
            }
          }
          return parts;
        });
      } else if (ev.type === "tool_error") {
        mutateAssistant((parts) => {
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            if (p.kind === "tool" && p.name === ev.name && p.result == null && !p.error) {
              const updated: ToolPart = { ...p, error: ev.error };
              return [...parts.slice(0, i), updated, ...parts.slice(i + 1)];
            }
          }
          return parts;
        });
      } else if (ev.type === "error") {
        mutateAssistant((parts) => [...parts, { kind: "error", content: ev.content }]);
      }
    };

    try {
      const response = await streamAPI("/api/agent/chat", {
        message: text.trim(),
        session_id: sessionId,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body.");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload) as AgentEvent;
            handleEvent(ev);
          } catch {
            handleEvent({
              type: "error",
              content: `Malformed event from agent: ${payload.slice(0, 160)}${
                payload.length > 160 ? "…" : ""
              }`,
            });
          }
        }
      }
    } catch (err) {
      mutateAssistant((parts) => [
        ...parts,
        { kind: "error", content: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setIsStreaming(false);
      refetchStatus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const suggestedCols = useMemo(() => (compact ? "grid-cols-1" : "sm:grid-cols-2"), [compact]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
            <Bot className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{title}</div>
            {!compact && <div className="text-xs text-slate-400">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetConversation}
            disabled={messages.length === 0 || isStreaming}
            className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-600 disabled:opacity-40"
            title="Clear conversation memory"
          >
            <RotateCw className="h-3 w-3" />
            Reset
          </button>
          <div
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              agentStatus?.configured
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            )}
            title={agentStatus?.message}
          >
            {agentStatus?.configured ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span className="sm:hidden">on</span>
                <span className="hidden sm:inline">
                  {compact ? "on" : agentStatus.model || "Connected"}
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                offline
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Sparkles className="mb-4 h-10 w-10 text-slate-600" />
            <p className="mb-4 text-center text-xs text-slate-500">
              Ask anything about the 545-week WACMR dataset
            </p>
            <div className={cn("grid w-full max-w-2xl gap-2", suggestedCols)}>
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-left text-[11px] text-slate-300 transition-colors hover:border-cyan-500/50 hover:bg-slate-800/80"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                    <Bot className="h-4 w-4 text-cyan-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "w-full space-y-3 rounded-xl px-4 py-3",
                    msg.role === "user"
                      ? "max-w-[85%] bg-blue-600 text-white"
                      : "max-w-[min(720px,85%)] bg-slate-800/70 text-slate-200"
                  )}
                >
                  {msg.parts.length === 0 && msg.role === "assistant" && isStreaming && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking…
                    </div>
                  )}
                  {msg.parts.map((part, j) => {
                    if (part.kind === "text") {
                      return (
                        <div key={j} className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{part.content}</ReactMarkdown>
                        </div>
                      );
                    }
                    if (part.kind === "tool") {
                      return <ToolPartBlock key={part.id} part={part} />;
                    }
                    if (part.kind === "error") {
                      return (
                        <div
                          key={j}
                          className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-sm text-rose-300"
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{part.content}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <User className="h-4 w-4 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            agentStatus?.configured
              ? "Ask about WACMR, SHAP, regimes, or counterfactuals…"
              : "Add GEMINI_API_KEY in backend/.env to enable the agent"
          }
          rows={1}
          disabled={!agentStatus?.configured || isStreaming}
          className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-60"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming || !agentStatus?.configured}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white transition-colors hover:bg-cyan-500 disabled:opacity-40"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
