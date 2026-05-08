"use client";

import { useEffect, useRef, useState } from "react";
import { askStash, type AskCitation, type AskEvent } from "../lib/api";

type AskMode = "stash" | "recipient";

interface AskRailProps {
  stashId: string | null;
  shareToken?: string;
  mode?: AskMode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations: AskCitation[];
}

const SUGGESTIONS_STASH = [
  "What changed last week?",
  "Top 3 risks?",
  "Best customer quote?",
  "Summarize the latest thread",
];

const SUGGESTIONS_RECIPIENT = [
  "30-sec summary",
  "Best stat for my IC memo",
  "Top 3 risks",
  "Source the customer quote",
];

export default function AskRail({
  stashId,
  shareToken,
  mode = "stash",
  collapsed = false,
  onToggleCollapsed,
}: AskRailProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const suggestions = mode === "recipient" ? SUGGESTIONS_RECIPIENT : SUGGESTIONS_STASH;

  async function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;
    if (mode === "stash" && !stashId) return;
    if (mode === "recipient" && !shareToken) return;

    const userMsg: ChatMessage = { role: "user", text: trimmed, citations: [] };
    const assistantMsg: ChatMessage = { role: "assistant", text: "", citations: [] };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    try {
      await askStash(
        { stashId, shareToken, messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.text })) },
        (event: AskEvent) => {
          setMessages((m) => {
            const next = [...m];
            const last = { ...next[next.length - 1] };
            if (event.type === "text") {
              last.text += event.delta;
            } else if (event.type === "tool") {
              last.citations = [
                ...last.citations,
                { id: `${event.name}-${last.citations.length}`, label: event.name, summary: event.result_summary ?? "" },
              ];
            }
            next[next.length - 1] = last;
            return next;
          });
        }
      );
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        const last = { ...next[next.length - 1] };
        last.text = last.text || `Error: ${(e as Error).message || String(e)}`;
        next[next.length - 1] = last;
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  if (collapsed) {
    // Fully hidden — the top header's rail-toggle button is the way back.
    return null;
  }

  const headerLabel = mode === "recipient" ? "Ask this deck" : "Ask this stash";
  const footerNote =
    mode === "recipient"
      ? "View-only — agent reads the deck but doesn't modify it."
      : "Grounded in this stash's content. Citations link to source.";

  return (
    <aside className="flex flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-brand-100)] text-[var(--color-brand-700)] text-[11px]">
            ✦
          </span>
          <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
            {headerLabel}
          </h2>
        </div>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="rounded p-1 text-muted hover:bg-raised hover:text-foreground"
            title="Collapse (⌘.)"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] text-muted">
              Ask anything about this {mode === "recipient" ? "deck" : "stash"}. The agent
              cites sources by default.
            </p>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-md border border-border bg-base px-3 py-2 text-left text-[12.5px] text-foreground transition-colors hover:border-[var(--color-brand-300)] hover:bg-[var(--color-brand-50)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] " +
                  (m.role === "user"
                    ? "self-end bg-[var(--color-brand-600)] text-white"
                    : "self-start border border-border bg-base text-foreground")
                }
              >
                {m.text || (streaming && i === messages.length - 1 ? "…" : "")}
                {m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.citations.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-md bg-raised px-1.5 py-0.5 text-[10px] text-dim"
                        title={c.summary}
                      >
                        ▦ {c.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t border-border bg-base px-3 py-2.5"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder={`Ask this ${mode === "recipient" ? "deck" : "stash"}…`}
          rows={2}
          className="w-full resize-none rounded-md border border-border bg-base px-2.5 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-[var(--color-brand-400)] focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">{footerNote}</span>
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-md bg-[var(--color-brand-600)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--color-brand-700)] disabled:opacity-40"
          >
            {streaming ? "…" : "Ask"}
          </button>
        </div>
      </form>
    </aside>
  );
}
