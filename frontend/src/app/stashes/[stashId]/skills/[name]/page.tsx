"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../../../../../components/AppShell";
import { useAuth } from "../../../../../hooks/useAuth";
import { getStashSkill, getWorkspace, type StashSkillDetail } from "../../../../../lib/api";
import type { Workspace } from "../../../../../lib/types";

export default function SkillPage() {
  const params = useParams();
  const router = useRouter();
  const stashId = params.stashId as string;
  const name = decodeURIComponent(params.name as string);
  const { user, loading, logout } = useAuth();

  const [stash, setStash] = useState<Workspace | null>(null);
  const [skill, setSkill] = useState<StashSkillDetail | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setStash(await getWorkspace(stashId));
      setSkill(await getStashSkill(stashId, name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load skill");
    }
  }, [stashId, name]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  if (!user) return null;

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-8 py-8 lg:grid-cols-[1fr_240px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-2 text-[12px] text-muted">
            <Link href={`/stashes/${stashId}`} className="hover:text-foreground">
              {stash?.name || "Stash"}
            </Link>
            <span>/</span>
            <span>Skills</span>
            <span>/</span>
            <span className="text-foreground">{name}</span>
          </div>

          <header className="mb-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-brand">
              <span>⚡</span> Skill · procedural
            </div>
            <h1 className="mt-2 font-display text-[34px] font-bold tracking-tight text-foreground">
              {skill?.name || name}
            </h1>
            {skill?.description && (
              <p className="mt-2 text-[14px] text-dim">{skill.description}</p>
            )}
            {skill?.when_to_use && (
              <p className="mt-1 text-[12px] italic text-muted">
                When to use: {skill.when_to_use}
              </p>
            )}
          </header>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                if (!skill) return;
                await navigator.clipboard.writeText(skill.combined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-md border border-border bg-base px-3 py-1.5 text-[12px] text-foreground hover:border-brand hover:text-brand"
            >
              {copied ? "Copied!" : "Copy as markdown"}
            </button>
            <span className="text-[11px] text-muted">
              Drop this file into any agent&apos;s skills directory.
            </span>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-400">
              {error}
            </div>
          )}

          <article className="markdown-content rounded-2xl border border-border bg-surface px-6 py-6 text-[14px] leading-relaxed text-foreground">
            {skill?.body ? (
              <pre className="whitespace-pre-wrap font-sans text-[14px]">{skill.body}</pre>
            ) : (
              <p className="text-muted">{skill ? "Empty skill body." : "Loading…"}</p>
            )}
          </article>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
              Files in this skill
            </div>
            <ul className="flex flex-col gap-1.5 text-[12px]">
              {skill?.files.map((f) => (
                <li key={f.id} className="truncate text-foreground">
                  {f.name === "SKILL.md" ? "📜" : "📄"} {f.name}
                </li>
              )) ?? null}
              {skill && skill.files.length === 0 && (
                <li className="italic text-muted">No files</li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
