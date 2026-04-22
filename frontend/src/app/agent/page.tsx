"use client";

import AgentChat from "@/components/agent/AgentChat";

const SUGGESTED_PROMPTS = [
  "What was the average WACMR in 2023 and how did it compare to the repo rate?",
  "What would happen to WACMR if the RBI cut the repo rate by 50 basis points?",
  "Plot WACMR and Repo Rate since 2018 — highlight the COVID break",
  "Which regime had higher volatility, and why?",
  "Explain the SHAP contributions for 2020-04-03 — what drove the prediction?",
  "How does CPI inflation correlate with WACMR across the two regimes?",
];

export default function AgentPage() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-5rem)] max-w-4xl flex-col lg:h-[calc(100vh-4rem)]">
      <AgentChat suggestedPrompts={SUGGESTED_PROMPTS} />
    </div>
  );
}
