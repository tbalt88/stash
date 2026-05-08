"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../../../../../components/AppShell";
import { useBreadcrumbs } from "../../../../../components/BreadcrumbContext";
import { useAuth } from "../../../../../hooks/useAuth";
import { getStashTranscript, getWorkspace, type SessionTranscript } from "../../../../../lib/api";
import type { Workspace } from "../../../../../lib/types";

interface Turn {
  role: "user" | "assistant" | "system" | "summary";
  content: string;
  raw: Record<string, unknown>;
}

function parseJsonl(text: string): Turn[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        const t = (obj.type as string) || "user";
        const content =
          (obj.content as string) ||
          (obj.summary as string) ||
          (obj.text as string) ||
          JSON.stringify(obj);
        return {
          role: (t === "summary" ? "summary" : t === "assistant" ? "assistant" : t === "system" ? "system" : "user") as Turn["role"],
          content,
          raw: obj,
        };
      } catch {
        return { role: "user" as Turn["role"], content: line, raw: { error: "parse" } };
      }
    });
}

export default function SessionViewerPage() {
  const params = useParams();
  const router = useRouter();
  const stashId = params.stashId as string;
  const sessionId = decodeURIComponent(params.sessionId as string);
  const { user, loading, logout } = useAuth();

  const [stash, setStash] = useState<Workspace | null>(null);
  const [transcript, setTranscript] = useState<SessionTranscript | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState("");

  useBreadcrumbs(
    [{ label: "Sessions" }, { label: `#${sessionId}` }],
    `${stashId}/session/${sessionId}`
  );

  const load = useCallback(async () => {
    try {
      setStash(await getWorkspace(stashId));
      const tx = await getStashTranscript(stashId, sessionId);
      setTranscript(tx);
      if (tx.download_url) {
        const res = await fetch(tx.download_url);
        if (res.ok) {
          const text = await res.text();
          setTurns(parseJsonl(text));
        } else {
          setError(`Couldn't download transcript: ${res.status}`);
        }
      } else {
        setError("Transcript has no download URL.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    }
  }, [stashId, sessionId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading)
    return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  if (!user) return null;

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="mx-auto max-w-3xl px-12 py-10">
        <div className="mb-2 flex items-center gap-2 text-[12px] uppercase tracking-wider text-[var(--color-brand-700)]">
          <span>💬</span> Session
          <span className="text-muted">·</span>
          <span className="italic text-muted">episodic memory</span>
        </div>
        <h1 className="font-display text-[36px] font-bold tracking-tight text-foreground">
          #{sessionId}
        </h1>
        {transcript && (
          <p className="mt-1 text-[13px] text-muted">
            {transcript.agent_name} · {turns.length} turn{turns.length === 1 ? "" : "s"} ·{" "}
            {(transcript.size_bytes / 1024).toFixed(1)} KB
            {stash ? <span> · in <span className="text-foreground">{stash.name}</span></span> : null}
            {transcript.cwd ? <span className="ml-2 font-mono text-[11px]">cwd: {transcript.cwd}</span> : null}
          </p>
        )}
        <div className="mt-6" />

        {error && (
          <div className="mb-4 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-500">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {turns.map((turn, i) => (
            <TurnRow key={i} turn={turn} />
          ))}
          {!error && turns.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-6 text-center text-[12.5px] text-muted">
              Loading transcript…
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function TurnRow({ turn }: { turn: Turn }) {
  if (turn.role === "summary") {
    return (
      <div className="rounded-lg border-l-4 border-[var(--color-brand-500)] bg-[var(--color-brand-50)] px-4 py-3 text-[13.5px]">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-700)]">
          📌 Summary
        </div>
        <div className="mt-1 text-foreground">{turn.content}</div>
      </div>
    );
  }

  const isAgent = turn.role === "assistant";
  const isSystem = turn.role === "system";

  return (
    <div className={"flex gap-3 " + (isAgent ? "flex-row" : "flex-row")}>
      <div
        className={
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold " +
          (isAgent
            ? "bg-violet-100 text-violet-700"
            : isSystem
            ? "bg-amber-100 text-amber-700"
            : "bg-rose-100 text-rose-700")
        }
      >
        {isAgent ? "A" : isSystem ? "S" : "U"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
          {isAgent ? "agent" : isSystem ? "system" : "user"}
        </div>
        <div className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-base px-3 py-2 text-[13.5px] text-foreground">
          {turn.content}
        </div>
      </div>
    </div>
  );
}
