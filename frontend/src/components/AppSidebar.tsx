"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getStashSpine,
  listMyWorkspaces,
  listPublicWorkspaces,
  type StashSpine,
} from "../lib/api";
import type { User, Workspace } from "../lib/types";

interface AppSidebarProps {
  user?: User;
  onLogout?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

interface StashNode extends Workspace {
  shared?: boolean;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={"transition-transform " + (open ? "rotate-90" : "")}
    >
      <path
        d="M3 2.5 L6 5 L3 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StashTreeNode({
  stash,
  expanded,
  onToggle,
  spine,
}: {
  stash: StashNode;
  expanded: boolean;
  onToggle: () => void;
  spine: StashSpine | null;
}) {
  const [bucket, setBucket] = useState<"sessions" | "skills" | "drive" | null>(null);

  return (
    <div className="text-[12px]">
      <div className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-raised">
        <button
          onClick={onToggle}
          className="flex h-4 w-4 items-center justify-center text-muted hover:text-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <Chevron open={expanded} />
        </button>
        <Link
          href={`/stashes/${stash.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-foreground hover:text-brand"
        >
          <span className="text-[10px]">📦</span>
          <span className="truncate">{stash.name}</span>
        </Link>
      </div>
      {expanded && (
        <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-border-subtle pl-2">
          {(["sessions", "skills", "drive"] as const).map((b) => {
            const open = bucket === b;
            const count =
              b === "sessions"
                ? spine?.sessions.length ?? 0
                : b === "skills"
                ? spine?.skills.length ?? 0
                : (spine?.drive.files.length ?? 0) + (spine?.drive.folders.length ?? 0);
            const icon = b === "sessions" ? "▤" : b === "skills" ? "⚡" : "▦";
            const label = b === "sessions" ? "Sessions" : b === "skills" ? "Skills" : "Drive";
            return (
              <div key={b}>
                <button
                  onClick={() => setBucket(open ? null : b)}
                  className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-foreground"
                >
                  <Chevron open={open} />
                  <span>{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                  <span className="text-muted">{count}</span>
                </button>
                {open && spine && (
                  <div className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-border-subtle pl-2">
                    {b === "sessions" &&
                      spine.sessions.slice(0, 12).map((s) => (
                        <Link
                          key={s.session_id}
                          href={`/stashes/${stash.id}/sessions/${s.session_id}`}
                          className="truncate rounded px-1 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-foreground"
                          title={`${s.agent_name} · ${s.session_id}`}
                        >
                          {s.agent_name}: {s.session_id.slice(0, 18)}
                        </Link>
                      ))}
                    {b === "skills" &&
                      spine.skills.map((s) => (
                        <Link
                          key={s.folder_id}
                          href={`/stashes/${stash.id}/skills/${encodeURIComponent(s.name)}`}
                          className="truncate rounded px-1 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-foreground"
                        >
                          ⚙ {s.name}
                        </Link>
                      ))}
                    {b === "drive" && (
                      <>
                        {spine.drive.folders.slice(0, 8).map((f) => (
                          <span
                            key={f.id}
                            className="truncate rounded px-1 py-0.5 text-[11px] text-dim"
                          >
                            📁 {f.name}
                          </span>
                        ))}
                        {spine.drive.files.slice(0, 8).map((f) => (
                          <Link
                            key={f.id}
                            href={`/files?ws=${stash.id}&file=${f.id}`}
                            className="truncate rounded px-1 py-0.5 text-[11px] text-dim hover:bg-raised hover:text-foreground"
                          >
                            📄 {f.name}
                          </Link>
                        ))}
                      </>
                    )}
                    {((b === "sessions" && spine.sessions.length === 0) ||
                      (b === "skills" && spine.skills.length === 0) ||
                      (b === "drive" &&
                        spine.drive.files.length === 0 &&
                        spine.drive.folders.length === 0)) && (
                      <span className="px-1 py-0.5 text-[10px] italic text-muted">empty</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AppSidebar({
  user,
  onLogout,
  collapsed,
  onToggleCollapsed,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [mine, setMine] = useState<Workspace[]>([]);
  const [shared, setShared] = useState<Workspace[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [spines, setSpines] = useState<Record<string, StashSpine>>({});
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    listMyWorkspaces()
      .then((r) => setMine(r.workspaces ?? []))
      .catch(() => {});
    if (user) {
      listPublicWorkspaces()
        .then((r) => {
          const ownIds = new Set((mine || []).map((w) => w.id));
          setShared((r.workspaces ?? []).filter((w) => !ownIds.has(w.id) && w.creator_id !== user.id).slice(0, 8));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const stashMatch = pathname.match(/^\/stashes\/([^/]+)/);
    if (stashMatch?.[1]) {
      setExpanded((m) => ({ ...m, [stashMatch[1]]: true }));
    }
  }, [pathname]);

  function toggleStash(id: string) {
    setExpanded((m) => {
      const next = { ...m, [id]: !m[id] };
      if (next[id] && !spines[id]) {
        getStashSpine(id)
          .then((s) => setSpines((sp) => ({ ...sp, [id]: s })))
          .catch(() => {});
      }
      return next;
    });
  }

  const displayName = user?.display_name || user?.name;
  const handle = user?.display_name ? user?.name : null;
  const avatarInitial = (displayName || "?")[0].toUpperCase();

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center gap-3 border-r border-border bg-surface py-3">
        <button
          onClick={onToggleCollapsed}
          className="font-display text-[18px] font-black tracking-[-0.03em] text-foreground hover:text-brand"
          title="Expand sidebar (⌘\\)"
        >
          s
        </button>
        <Link
          href="/discover"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-foreground"
          title="Discover"
        >
          ◐
        </Link>
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-foreground"
          title="Activity"
        >
          ⏱
        </Link>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col overflow-hidden border-r border-border bg-surface">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <Link
          href="/"
          className="font-display text-[20px] font-black tracking-[-0.03em] text-foreground"
        >
          stash
        </Link>
        <button
          className="rounded-md border border-border-subtle bg-base px-2 py-0.5 text-[10px] text-muted hover:text-foreground"
          title="Search (⌘K)"
        >
          ⌘K
        </button>
      </div>

      <div className="flex flex-col gap-0.5 px-2">
        <Link
          href="/discover"
          className={
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] " +
            (pathname.startsWith("/discover")
              ? "bg-brand-muted text-brand"
              : "text-dim hover:bg-raised hover:text-foreground")
          }
        >
          <span>◐</span> Discover
        </Link>
        <Link
          href="/memory"
          className={
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] " +
            (pathname.startsWith("/memory")
              ? "bg-brand-muted text-brand"
              : "text-dim hover:bg-raised hover:text-foreground")
          }
        >
          <span>⏱</span> Activity
        </Link>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-2">
        {shared.length > 0 && (
          <div className="mb-3">
            <div className="px-1 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted">
              Shared with me
            </div>
            <div className="flex flex-col gap-0.5">
              {shared.map((s) => (
                <StashTreeNode
                  key={s.id}
                  stash={{ ...s, shared: true }}
                  expanded={!!expanded[s.id]}
                  onToggle={() => toggleStash(s.id)}
                  spine={spines[s.id] ?? null}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between px-1 pb-1 pt-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              My stashes
            </span>
            <Link
              href="/stashes/new"
              className="text-[11px] text-muted hover:text-foreground"
              title="New stash"
            >
              +
            </Link>
          </div>
          <div className="flex flex-col gap-0.5">
            {mine.map((s) => (
              <StashTreeNode
                key={s.id}
                stash={s}
                expanded={!!expanded[s.id]}
                onToggle={() => toggleStash(s.id)}
                spine={spines[s.id] ?? null}
              />
            ))}
            {mine.length === 0 && (
              <div className="px-1 py-1 text-[11px] italic text-muted">
                No stashes yet — <Link href="/stashes/new" className="text-brand">create one</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle px-2 py-2">
        <Link
          href="/docs"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-dim hover:bg-raised hover:text-foreground"
        >
          <span>?</span> Docs
        </Link>
      </div>

      {user && (
        <div className="relative border-t border-border-subtle px-2 py-3">
          <button
            type="button"
            onClick={() => setShowUserMenu((o) => !o)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-raised"
            aria-expanded={showUserMenu}
          >
            <span
              className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-white"
              style={{ background: "var(--color-brand)" }}
            >
              {avatarInitial}
            </span>
            <div className="flex min-w-0 flex-col">
              <div className="truncate text-[12px] font-medium text-foreground">
                {displayName}
              </div>
              {handle && <div className="truncate text-[10px] text-muted">@{handle}</div>}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapsed?.();
              }}
              className="ml-auto rounded px-1 text-[10px] text-muted hover:text-foreground"
              title="Collapse sidebar (⌘\\)"
            >
              ⌘\
            </button>
          </button>
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute bottom-full left-2 right-2 z-50 mb-1 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="block px-3 py-2 text-[13px] text-foreground transition hover:bg-raised"
                >
                  Settings
                </Link>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="block w-full cursor-pointer px-3 py-2 text-left text-[13px] text-foreground transition hover:bg-raised"
                  >
                    Log out
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
