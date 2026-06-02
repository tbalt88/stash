"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import MemoryAskStep from "../../../../onboarding/paths/memory/MemoryAskStep";

// Agents: the primary way to use Stash is through your own agent. The first tab
// (unclosable) explains how to connect the CLI / MCP / API; extra tabs are quick
// chats over your sources.
type ChatTab = { id: number; title: string };

export default function AgentsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [chats, setChats] = useState<ChatTab[]>([]);
  const [nextId, setNextId] = useState(1);
  const [active, setActive] = useState<"connect" | number>("connect");

  function newChat() {
    const id = nextId;
    setChats((c) => [...c, { id, title: `Chat ${id}` }]);
    setNextId((n) => n + 1);
    setActive(id);
  }

  function closeChat(id: number) {
    setChats((c) => c.filter((t) => t.id !== id));
    setActive((a) => (a === id ? "connect" : a));
  }

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-foreground">Agents</h1>
        <p className="mt-1 text-[13px] text-muted">
          Use Stash through your own agent. Connect once, then ask it anything about your company data.
        </p>

        <div className="mt-5 flex items-center gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActive("connect")}
            className={tabClass(active === "connect")}
          >
            Connect your agent
          </button>
          {chats.map((t) => (
            <span key={t.id} className={tabClass(active === t.id)}>
              <button type="button" onClick={() => setActive(t.id)} className="outline-none">
                {t.title}
              </button>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => closeChat(t.id)}
                className="ml-1 text-muted hover:text-error"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={newChat}
            aria-label="New chat"
            className="px-3 py-2 text-[16px] text-muted hover:text-foreground"
          >
            ＋
          </button>
        </div>

        <div className="pt-5">
          {active === "connect" ? (
            <ConnectGuide />
          ) : (
            <MemoryAskStep workspaceId={workspaceId} />
          )}
        </div>
      </div>
    </div>
  );
}

function tabClass(activeTab: boolean): string {
  return (
    "flex items-center gap-0.5 rounded-t-md border border-b-0 px-3 py-2 text-[12.5px] -mb-px " +
    (activeTab
      ? "border-border bg-base font-semibold text-foreground"
      : "border-transparent bg-surface text-dim hover:text-foreground")
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[13.5px] font-semibold text-foreground">
        {n}. {title}
      </div>
      <div className="mt-2 text-[13px] text-dim">{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-[12px] text-foreground">
      {children}
    </pre>
  );
}

function ConnectGuide() {
  return (
    <div className="rounded-xl border border-border bg-base p-5">
      <Step n={1} title="Install the Stash CLI">
        The CLI is the preferred way for your agent to reach Stash.
        <Code>{`bash -c "$(curl -fsSL https://joinstash.ai/install)"`}</Code>
      </Step>
      <Step n={2} title="Sign in">
        Authorize the CLI for this account — it prints a consent URL.
        <Code>stash signin</Code>
      </Step>
      <Step n={3} title="Point your agent at it (MCP)">
        Add Stash as an MCP server so your agent can navigate and search every source.
        See the{" "}
        <a className="text-[var(--color-brand-700)] underline" href="https://joinstash.ai/docs/mcp" target="_blank" rel="noopener noreferrer">
          MCP setup docs
        </a>
        .
      </Step>
      <Step n={4} title="Or call the API directly">
        Create a personal API key in{" "}
        <a className="text-[var(--color-brand-700)] underline" href="/settings">
          Settings
        </a>{" "}
        and read the{" "}
        <a className="text-[var(--color-brand-700)] underline" href="https://joinstash.ai/docs/api" target="_blank" rel="noopener noreferrer">
          API docs
        </a>
        .
      </Step>
      <div className="mt-4 rounded-md bg-surface px-3 py-2 text-[12.5px] text-muted">
        Prefer the browser? Open a chat tab above and ask across your sources right here.
      </div>
    </div>
  );
}
