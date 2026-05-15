"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StashIcon } from "../../../../components/StashIcons";
import { useShareModal } from "../../../../lib/shareModalContext";
import { listStashes, type WorkspaceStash } from "../../../../lib/api";

export default function WorkspaceStashesPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const shareModal = useShareModal();
  const shareVersion = shareModal.version;

  const [stashes, setStashes] = useState<WorkspaceStash[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await listStashes(workspaceId);
      setStashes(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stashes");
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load, shareVersion]);

  const filtered = useMemo<WorkspaceStash[]>(() => {
    if (!stashes) return [];
    const ordered = [...stashes].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const q = query.trim().toLowerCase();
    if (!q) return ordered;

    return ordered.filter((stash) => {
      const haystack = [stash.title, stash.description, stash.slug].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [stashes, query]);

  const internal = useMemo(() => filtered.filter((stash) => !stash.is_external), [filtered]);
  const external = useMemo(() => filtered.filter((stash) => stash.is_external), [filtered]);

  if (stashes === null) {
    return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  }

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-12 py-8">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          <Link href={`/workspaces/${workspaceId}`} className="hover:text-foreground">
            Home
          </Link>
          <span className="text-muted/60">/</span>
          <span className="font-medium text-foreground">Stashes</span>
        </nav>

        <div className="mb-1 flex h-10 w-10 items-center justify-center text-4xl text-muted">
          <StashIcon />
        </div>
        <h1 className="font-display text-[28px] font-bold tracking-tight text-foreground">
          Stashes
        </h1>
        <button
          type="button"
          onClick={() =>
            shareModal.open({
              workspaceId,
              tab: "new",
            })
          }
          className="mt-3 rounded-md bg-[var(--color-brand-600)] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--color-brand-700)]"
        >
          New stash
        </button>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-500">
            {error}
          </div>
        )}

        <div className="mt-5 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stashes by title, description, or slug…"
            className="w-full rounded-md border border-border bg-base px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted focus:border-[var(--color-brand-300)] focus:outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-6 text-center text-[12.5px] text-muted">
            {stashes.length === 0 ? "No stashes yet." : "No stashes match your search."}
          </div>
        ) : (
          <div className="space-y-6">
            {internal.length > 0 && (
              <section>
                <h2 className="mb-2 font-display text-[15px] font-semibold text-foreground">
                  Workspace stashes
                </h2>
                <ul className="space-y-2">
                  {internal.map((stash) => (
                    <StashListItem key={stash.id} stash={stash} />
                  ))}
                </ul>
              </section>
            )}
            {external.length > 0 && (
              <section>
                <h2 className="mb-2 font-display text-[15px] font-semibold text-foreground">
                  External stashes
                </h2>
                <ul className="space-y-2">
                  {external.map((stash) => (
                    <StashListItem key={stash.id} stash={stash} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StashListItem({ stash }: { stash: WorkspaceStash }) {
  return (
    <li>
      <Link
        href={`/stashes/${stash.slug}`}
        className="flex items-start gap-3 rounded-lg border border-border bg-base p-3 text-left transition-colors hover:border-[var(--color-brand-200)] hover:bg-[var(--color-brand-50)]"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-2xl text-muted">
          <StashIcon />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-foreground">
            {stash.title}
          </div>
          <div className="truncate text-[11.5px] text-muted">
            {stash.description || "No description"}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {stash.items.length} item{stash.items.length === 1 ? "" : "s"} · {stash.is_external ? "External" : "Workspace"}
          </div>
        </div>
      </Link>
    </li>
  );
}
