"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppShell from "../../../components/AppShell";
import { useAuth } from "../../../hooks/useAuth";
import {
  getStashSpine,
  getWorkspace,
  getWorkspaceMembers,
  joinWorkspace,
  type StashSpine,
} from "../../../lib/api";
import type { Workspace, WorkspaceMember } from "../../../lib/types";

function Bucket({
  icon,
  title,
  subtitle,
  count,
  href,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  count: number;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <Link href={href} className="flex items-start gap-3 hover:text-brand">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-muted text-[18px] text-brand">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            <span className="text-[11px] uppercase tracking-wider text-muted">{subtitle}</span>
            <span className="ml-auto text-[12px] text-muted">{count}</span>
          </div>
        </div>
      </Link>
      <div className="mt-4 border-t border-border-subtle pt-3">{children}</div>
    </section>
  );
}

export default function StashHomePage() {
  const params = useParams();
  const router = useRouter();
  const stashId = params.stashId as string;
  const { user, loading, logout } = useAuth();

  const [stash, setStash] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [spine, setSpine] = useState<StashSpine | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setStash(await getWorkspace(stashId));
    } catch {
      setError("Stash not found");
    }
    try {
      setMembers(await getWorkspaceMembers(stashId));
    } catch {
      /* not a member yet */
    }
    try {
      setSpine(await getStashSpine(stashId));
    } catch {
      /* private */
    }
  }, [stashId]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const isMember = !!user && members.some((m) => m.user_id === user.id);

  async function handleJoin() {
    if (!stash) return;
    try {
      await joinWorkspace(stash.invite_code);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  if (!user) return null;

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="mx-auto max-w-3xl px-8 py-10">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-[var(--color-brand-deep)] via-[var(--color-brand-hover)] to-[var(--color-brand)] px-6 py-8 text-white">
          <div className="text-[11px] uppercase tracking-[0.2em] opacity-80">Stash</div>
          <h1 className="mt-1 font-display text-[34px] font-bold tracking-tight">
            {stash?.name || "Loading…"}
          </h1>
          {stash?.description && (
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed opacity-90">
              {stash.description}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3 text-[12px] opacity-80">
            <span>{members.length} member{members.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{stash?.is_public ? "Public" : "Private"}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-400">
            {error}
          </div>
        )}

        {!isMember && stash && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-[13px]">
            <span className="text-dim">You aren&apos;t a member of this stash.</span>
            <button
              onClick={handleJoin}
              className="rounded-md bg-brand px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--color-brand-hover)]"
            >
              Join stash
            </button>
          </div>
        )}

        {/* Three-folder spine */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Bucket
            icon="▤"
            title="Sessions"
            subtitle="episodic"
            count={spine?.sessions.length ?? 0}
            href={`/memory?ws=${stashId}`}
          >
            {spine?.sessions.length ? (
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {spine.sessions.slice(0, 5).map((s) => (
                  <li
                    key={s.session_id}
                    className="flex flex-col gap-0 truncate text-foreground"
                  >
                    <span className="truncate font-medium">{s.agent_name}</span>
                    <span className="truncate text-[10px] text-muted">
                      {s.session_id.slice(0, 24)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted">Drop a transcript to start.</p>
            )}
          </Bucket>

          <Bucket
            icon="⚡"
            title="Skills"
            subtitle="procedural"
            count={spine?.skills.length ?? 0}
            href={`/wiki?ws=${stashId}`}
          >
            {spine?.skills.length ? (
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {spine.skills.slice(0, 5).map((s) => (
                  <li key={s.folder_id}>
                    <Link
                      href={`/stashes/${stashId}/skills/${encodeURIComponent(s.name)}`}
                      className="flex items-center gap-1.5 text-foreground hover:text-brand"
                    >
                      <span>⚙</span>
                      <span className="truncate">{s.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted">Add a SKILL.md folder.</p>
            )}
          </Bucket>

          <Bucket
            icon="▦"
            title="Drive"
            subtitle="semantic"
            count={
              (spine?.drive.files.length ?? 0) + (spine?.drive.folders.length ?? 0)
            }
            href={`/files?ws=${stashId}`}
          >
            {spine && (spine.drive.files.length || spine.drive.folders.length) ? (
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {spine.drive.folders.slice(0, 3).map((f) => (
                  <li key={f.id} className="truncate text-foreground">
                    📁 {f.name}
                  </li>
                ))}
                {spine.drive.files.slice(0, 5).map((f) => (
                  <li key={f.id} className="truncate text-foreground">
                    📄 {f.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted">Upload files or create wiki pages.</p>
            )}
          </Bucket>
        </div>
      </div>
    </AppShell>
  );
}
