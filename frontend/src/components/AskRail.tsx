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
    return (
      <aside className="flex w-12 flex-shrink-0 flex-col items-center gap-3 border-l border-border bg-surface py-3">
        <button
          onClick={onToggleCollapsed}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-foreground"
          aria-label="Open Ask"
          title="Ask this stash (⌘.)"
        >
          ✦
        </button>
        <div className="font-display text-[10px] font-medium uppercase tracking-wider text-muted [writing-mode:vertical-rl]">
          Ask this {mode === "recipient" ? "deck" : "stash"}
        </div>
      </aside>
    );
  }

  const headerLabel = mode === "recipient" ? "Ask this deck" : "Ask this stash";
  const footerNote =
    mode === "recipient"
      ? "View-only — agent reads the deck but doesn't modify it."
      : "Grounded in this stash's content. Citations link to source.";

  return (
    <aside className="flex w-[360px] flex-shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-muted text-brand">
            ✦
          </span>
          <h2 className="font-display text-[14px] font-semibold tracking-tight text-foreground">
            {headerLabel}
          </h2>
        </div>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="text-[11px] text-muted hover:text-foreground"
            title="Collapse (⌘.)"
          >
            ⌘.
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] text-muted">
              Ask anything about this {mode === "recipient" ? "deck" : "stash"}. The agent
              cites sources by default.
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-lg border border-border bg-base px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:border-brand hover:bg-brand-muted"
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
                    ? "self-end bg-brand text-white"
                    : "self-start bg-base text-foreground border border-border-subtle")
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
        className="border-t border-border-subtle bg-base px-3 py-3"
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
          className="w-full resize-none rounded-md border border-border-subtle bg-surface px-2.5 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">{footerNote}</span>
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-md bg-brand px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--color-brand-hover)] disabled:opacity-40"
          >
            {streaming ? "…" : "Ask"}
          </button>
        </div>
      </form>
    </aside>
  );
}
