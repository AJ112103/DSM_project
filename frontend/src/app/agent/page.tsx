"use client";

import dynamic from "next/dynamic";
import type Plotly from "plotly.js";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI, streamAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG } from "@/lib/plotly-theme";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface MessageContent {
  type: "text" | "sql" | "chart" | "table" | "error";
  content: string;
  data?: Record<string, unknown>;
}

interface ChatMessage {
  role: "user" | "assistant";
  parts: MessageContent[];
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "What was the average WACMR in 2023?",
  "Show me the top 5 most important features for prediction",
  "Plot WACMR vs Repo Rate over time",
  "Which regime had higher volatility?",
  "What was the directional accuracy of the forecast model?",
  "Show me the correlation between WACMR and CPI inflation",
];

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: agentStatus } = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => fetchAPI("/api/agent/status").catch(() => ({ configured: false })),
    retry: false,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      parts: [{ type: "text", content: text.trim() }],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await streamAPI("/api/agent/chat", {
        message: text.trim(),
        history: messages.map((m) => ({
          role: m.role,
          content: m.parts.map((p) => p.content).join("\n"),
        })),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const parts: MessageContent[] = [];
        let currentText = "";

        if (reader) {
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") {
                    done = true;
                    break;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === "text") {
                      currentText += parsed.content || "";
                      // Update message in real-time
                      const updatedParts = [
                        ...parts,
                        { type: "text" as const, content: currentText },
                      ];
                      setMessages((prev) => {
                        const updated = [...prev];
                        const lastIdx = updated.length - 1;
                        if (
                          lastIdx >= 0 &&
                          updated[lastIdx].role === "assistant"
                        ) {
                          updated[lastIdx] = {
                            ...updated[lastIdx],
                            parts: updatedParts,
                          };
                        } else {
                          updated.push({
                            role: "assistant",
                            parts: updatedParts,
                            timestamp: new Date(),
                          });
                        }
                        return updated;
                      });
                    } else if (parsed.type === "text_done") {
                      if (currentText) {
                        parts.push({
                          type: "text",
                          content: currentText,
                        });
                        currentText = "";
                      }
                    } else {
                      if (currentText) {
                        parts.push({
                          type: "text",
                          content: currentText,
                        });
                        currentText = "";
                      }
                      parts.push({
                        type: parsed.type,
                        content: parsed.content || "",
                        data: parsed.data,
                      });
                      setMessages((prev) => {
                        const updated = [...prev];
                        const lastIdx = updated.length - 1;
                        if (
                          lastIdx >= 0 &&
                          updated[lastIdx].role === "assistant"
                        ) {
                          updated[lastIdx] = {
                            ...updated[lastIdx],
                            parts: [...parts],
                          };
                        } else {
                          updated.push({
                            role: "assistant",
                            parts: [...parts],
                            timestamp: new Date(),
                          });
                        }
                        return updated;
                      });
                    }
                  } catch {
                    // Non-JSON SSE line, treat as text
                    currentText += data;
                  }
                }
              }
            }
          }

          // Finalize
          if (currentText) {
            parts.push({ type: "text", content: currentText });
          }
          if (parts.length > 0) {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  parts: [...parts],
                };
              } else {
                updated.push({
                  role: "assistant",
                  parts: [...parts],
                  timestamp: new Date(),
                });
              }
              return updated;
            });
          }
        }
      } else {
        // JSON response (non-streaming)
        const json = await response.json();
        const parts: MessageContent[] = [];

        if (json.response) {
          parts.push({ type: "text", content: json.response });
        }
        if (json.sql) {
          parts.push({ type: "sql", content: json.sql });
        }
        if (json.chart) {
          parts.push({
            type: "chart",
            content: "",
            data: json.chart,
          });
        }
        if (json.table) {
          parts.push({
            type: "table",
            content: "",
            data: json.table,
          });
        }
        if (json.error) {
          parts.push({ type: "error", content: json.error });
        }
        if (parts.length === 0 && json.message) {
          parts.push({ type: "text", content: json.message });
        }
        if (parts.length === 0) {
          parts.push({ type: "text", content: JSON.stringify(json, null, 2) });
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", parts, timestamp: new Date() },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          parts: [
            {
              type: "error",
              content:
                err instanceof Error
                  ? err.message
                  : "Failed to connect to the agent",
            },
          ],
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
            <Bot className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Agent</h1>
            <p className="text-sm text-slate-400">
              Ask questions about the data in natural language
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
            agentStatus?.configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
          )}
        >
          {agentStatus?.configured ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              Not configured
            </>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Sparkles className="mb-4 h-12 w-12 text-slate-600" />
            <p className="mb-6 text-center text-sm text-slate-500">
              Start by asking a question or try a suggestion below
            </p>
            <div className="grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-left text-xs text-slate-300 transition-colors hover:border-blue-500/50 hover:bg-slate-800/80"
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
                    "max-w-[80%] space-y-3 rounded-xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-200"
                  )}
                >
                  {msg.parts.map((part, j) => (
                    <div key={j}>
                      {part.type === "text" && (
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{part.content}</ReactMarkdown>
                        </div>
                      )}
                      {part.type === "sql" && (
                        <div className="overflow-x-auto rounded-lg bg-slate-950 p-3">
                          <pre className="text-xs text-emerald-400">
                            <code>{part.content}</code>
                          </pre>
                        </div>
                      )}
                      {part.type === "chart" && part.data && (
                        <div className="overflow-hidden rounded-lg">
                          <Plot
                            data={((part.data as { data?: Plotly.Data[] }).data || []) as Plotly.Data[]}
                            layout={{
                              ...PLOTLY_DARK_LAYOUT,
                              ...((part.data as { layout?: Record<string, unknown> }).layout || {}),
                              height: 300,
                              width: undefined,
                            }}
                            config={PLOTLY_CONFIG}
                            className="w-full"
                          />
                        </div>
                      )}
                      {part.type === "table" && part.data && (
                        <div className="overflow-x-auto rounded-lg">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700">
                                {(
                                  (part.data as { columns?: string[] }).columns ||
                                  Object.keys(
                                    ((part.data as { rows?: Record<string, unknown>[] }).rows || [])[0] || {}
                                  )
                                ).map((col: string) => (
                                  <th
                                    key={col}
                                    className="px-3 py-2 text-left text-slate-400"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {((part.data as { rows?: Record<string, unknown>[] }).rows || []).map(
                                (row: Record<string, unknown>, ri: number) => (
                                  <tr
                                    key={ri}
                                    className="border-b border-slate-800"
                                  >
                                    {(
                                      (part.data as { columns?: string[] }).columns ||
                                      Object.keys(row)
                                    ).map((col: string) => (
                                      <td
                                        key={col}
                                        className="px-3 py-1.5 font-mono text-slate-300"
                                      >
                                        {String(
                                          row[col] ?? ""
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {part.type === "error" && (
                        <div className="flex items-center gap-2 text-rose-400">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span className="text-sm">{part.content}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <User className="h-4 w-4 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Bot className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="rounded-xl bg-slate-800 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="mt-4 flex gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the data..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
        >
          {isStreaming ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
