"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import {
  createWorkspace,
  joinWorkspace,
  listAllPages,
  listMySessions,
  listMyWorkspaces,
  listStashes,
  type WorkspaceStash,
  UserPageEntry,
} from "../lib/api";
import type { SessionSummary } from "../lib/api";
import type { Workspace } from "../lib/types";

interface RecentStash extends WorkspaceStash {
  workspace_name: string;
}

interface HomeData {
  workspaces: Workspace[];
  stashes: RecentStash[];
  recentPages: UserPageEntry[];
  recentSessions: SessionSummary[];
}

function emptyHomeData(): HomeData {
  return { workspaces: [], stashes: [], recentPages: [], recentSessions: [] };
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading...</div>;
  }

  return <LoggedInHome user={user} logout={logout} />;
}

function LoggedInHome({
  user,
  logout,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  logout: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<HomeData>(emptyHomeData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [workspaceResult, pageResult, sessionResult] = await Promise.all([
        listMyWorkspaces(),
        listAllPages(),
        listMySessions(undefined, 8),
      ]);
      const stashes = await Promise.all(
        workspaceResult.workspaces.map(async (workspace) => {
          const workspaceStashes = await listStashes(workspace.id);
          return workspaceStashes.map((stash) => ({ ...stash, workspace_name: workspace.name }));
        })
      );
      setData({
        workspaces: workspaceResult.workspaces,
        stashes: stashes.flat().sort((a, b) => dateSort(b.updated_at, a.updated_at)).slice(0, 8),
        recentPages: pageResult.pages.slice(0, 8),
        recentSessions: sessionResult,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Stash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ownedWorkspaces = useMemo(
    () => data.workspaces.filter((workspace) => workspace.creator_id === user.id),
    [data.workspaces, user.id]
  );
  const sharedWorkspaces = useMemo(
    () => data.workspaces.filter((workspace) => workspace.creator_id !== user.id),
    [data.workspaces, user.id]
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setError("");
    try {
      const workspace = await createWorkspace(newName.trim(), newDesc.trim());
      router.push(`/workspaces/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
      setCreating(false);
    }
  }

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setError("");
    try {
      const workspace = await joinWorkspace(joinCode.trim());
      router.push(`/workspaces/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join workspace");
      setJoining(false);
    }
  }

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8">
        <header className="grid gap-6 border-b border-border-subtle pb-7 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Newsfeed
            </p>
            <h1 className="mt-3 font-display text-[34px] font-bold tracking-tight text-foreground">
              Agent work, organized into workspaces.
            </h1>
            <p className="mt-3 max-w-[700px] text-[14.5px] leading-[1.6] text-muted">
              A Stash Workspace is the shared container for your team&apos;s agent
              sessions, Files, and Stashes you publish or hand to another workspace.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/search"
                className="rounded-md bg-[var(--color-brand-600)] px-3 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-700)]"
              >
                Search everything
              </Link>
              <Link
                href="/discover"
                className="rounded-md border border-border bg-base px-3 py-2 text-[13px] text-foreground hover:bg-raised"
              >
                Discover public stashes
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleCreate}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="font-display text-[16px] font-semibold text-foreground">
              Create a workspace
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="e.g. Growth engineering"
                className="rounded-md border border-border bg-base px-3 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <textarea
                value={newDesc}
                onChange={(event) => setNewDesc(event.target.value)}
                rows={3}
                placeholder="What should this workspace collect?"
                className="resize-none rounded-md border border-border bg-base px-3 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="rounded-md bg-[var(--color-brand-600)] px-3 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-700)] disabled:opacity-45"
              >
                {creating ? "Creating..." : "Create workspace"}
              </button>
            </div>
          </form>
        </header>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0">
            <SectionTitle title="My workspaces" count={ownedWorkspaces.length} />
            {loading ? (
              <LoadingRows />
            ) : ownedWorkspaces.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {ownedWorkspaces.map((workspace) => (
                  <WorkspaceCard key={workspace.id} workspace={workspace} />
                ))}
              </div>
            ) : (
              <EmptyState text="Create your first workspace to collect sessions, Files, and Stashes." />
            )}

            <div className="mt-8">
              <SectionTitle title="Shared workspaces" count={sharedWorkspaces.length} />
              {sharedWorkspaces.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {sharedWorkspaces.map((workspace) => (
                    <WorkspaceCard key={workspace.id} workspace={workspace} shared />
                  ))}
                </div>
              ) : (
                <EmptyState text="Workspaces another admin adds you to show up here." />
              )}
            </div>
          </main>

          <aside className="flex min-w-0 flex-col gap-5">
            <form onSubmit={handleJoin} className="rounded-lg border border-border bg-surface p-4">
              <h2 className="font-display text-[16px] font-semibold text-foreground">
                Add by invite
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                Join a private workspace with an admin-provided invite code.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="Invite code"
                  className="min-w-0 flex-1 rounded-md border border-border bg-base px-3 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={joining || !joinCode.trim()}
                  className="rounded-md border border-border bg-base px-3 py-2 text-[13px] font-medium text-foreground hover:bg-raised disabled:opacity-45"
                >
                  {joining ? "Joining..." : "Join"}
                </button>
              </div>
            </form>

            <StashPanel stashes={data.stashes} />

            <ActivityPanel
              title="Recent pages"
              empty="No pages yet."
              items={data.recentPages.map((page) => ({
                id: page.id,
                href: `/workspaces/${page.workspace_id}/p/${page.id}`,
                title: page.name,
                meta: `${page.workspace_name}${page.folder_path.length ? " / " + page.folder_path.join("/") : ""} / ${relativeTime(page.updated_at)}`,
              }))}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-[20px] font-semibold text-foreground">{title}</h2>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {count}
      </span>
    </div>
  );
}

function WorkspaceCard({
  workspace,
  shared = false,
}: {
  workspace: Workspace;
  shared?: boolean;
}) {
  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="group min-w-0 rounded-lg border border-border bg-base p-4 transition hover:border-[var(--color-brand-300)] hover:bg-[var(--color-brand-50)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[16px] font-semibold text-foreground group-hover:text-[var(--color-brand-700)]">
            {workspace.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-[40px] text-[13px] leading-relaxed text-muted">
            {workspace.description || "No description."}
          </p>
        </div>
        {shared && (
          <span className="shrink-0 rounded-md border border-border-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            shared
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-dim">
        <span>{workspace.member_count ?? 0} members</span>
      </div>
    </Link>
  );
}

function StashPanel({ stashes }: { stashes: RecentStash[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-[16px] font-semibold text-foreground">
        Recent stashes
      </h2>
      <div className="mt-3 flex flex-col gap-1">
        {stashes.length > 0 ? (
          stashes.map((stash) => (
            <Link
              key={stash.id}
              href={`/stashes/${stash.slug}`}
              className="rounded-md px-2 py-2 hover:bg-raised"
            >
              <div className="line-clamp-1 text-[13px] font-medium text-foreground">
                {stash.title}
              </div>
              <div className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">
                {stash.workspace_name} / {stash.items.length} items / {relativeTime(stash.updated_at)}
              </div>
            </Link>
          ))
        ) : (
          <p className="py-3 text-[12.5px] text-muted">
            Create a stash from any workspace Share button.
          </p>
        )}
      </div>
    </section>
  );
}

function ActivityPanel({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; href: string; title: string; meta: string }[];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-[16px] font-semibold text-foreground">{title}</h2>
      <div className="mt-3 flex flex-col gap-1">
        {items.length > 0 ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-md px-2 py-2 hover:bg-raised"
            >
              <div className="line-clamp-1 text-[13px] font-medium text-foreground">
                {item.title}
              </div>
              <div className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">{item.meta}</div>
            </Link>
          ))
        ) : (
          <p className="py-3 text-[12.5px] text-muted">{empty}</p>
        )}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-[13px] text-muted">
      {text}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {[0, 1].map((item) => (
        <div key={item} className="h-[132px] rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dateSort(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}
