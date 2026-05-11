"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import { useBreadcrumbs } from "../../components/BreadcrumbContext";
import { useAuth } from "../../hooks/useAuth";
import type { CatalogCard } from "../../lib/api";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

async function fetchCatalog(params: {
  q?: string;
  sort?: string;
  category?: string;
  tag?: string;
}): Promise<CatalogCard[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const res = await fetch(
    `${BACKEND_ORIGIN}/api/v1/discover/workspaces${qs.size ? `?${qs}` : ""}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.workspaces ?? [];
}

export default function DiscoverPage() {
  const { user, loading, logout } = useAuth();
  const [sort, setSort] = useState("trending");
  const [query, setQuery] = useState("");
  const [stashes, setStashes] = useState<CatalogCard[]>([]);
  const [fetching, setFetching] = useState(true);

  useBreadcrumbs([{ label: "Discover" }], "discover");

  useEffect(() => {
    setFetching(true);
    fetchCatalog({ q: query || undefined, sort })
      .then(setStashes)
      .finally(() => setFetching(false));
  }, [query, sort]);

  const content = (
    <div className="mx-auto max-w-[1100px] px-8 py-10">
      <h1 className="font-display text-[34px] font-bold tracking-tight text-foreground">
        Discover
      </h1>
      <p className="mt-2 text-[14.5px] text-muted">
        Public stashes you can read, fork, or join.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search public stashes…"
          className="flex-1 rounded-lg border border-border bg-base px-3 py-2 text-[13px] text-foreground placeholder:text-muted focus:border-[var(--color-brand-400)] focus:outline-none"
        />
        <div className="flex rounded-md border border-border bg-base p-0.5 text-[12px]">
          {(["trending", "newest", "forks"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={
                "rounded px-2.5 py-1 capitalize " +
                (sort === s
                  ? "bg-raised font-medium text-foreground"
                  : "text-muted hover:text-foreground")
              }
            >
              {s === "forks" ? "Most forked" : s}
            </button>
          ))}
        </div>
      </div>

      {fetching ? (
        <p className="mt-12 text-center text-[13px] text-muted">Loading…</p>
      ) : stashes.length === 0 ? (
        <p className="mt-12 text-center text-[13px] text-muted">
          No public stashes yet.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stashes.map((w) => (
            <StashCard key={w.id} ws={w} />
          ))}
        </div>
      )}
    </div>
  );

  if (loading) return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;

  if (user) {
    return <AppShell user={user} onLogout={logout}>{content}</AppShell>;
  }
  return <main>{content}</main>;
}

function StashCard({ ws }: { ws: CatalogCard }) {
  const owner = ws.creator_display_name || ws.creator_name;
  return (
    <Link
      href={`/stashes/${ws.id}`}
      className="group flex flex-col rounded-xl border border-border bg-base p-5 transition hover:border-[var(--color-brand-300)]"
    >
      <h3 className="font-display text-[17px] font-bold text-foreground group-hover:text-[var(--color-brand-700)]">
        {ws.name}
      </h3>
      <p className="mt-2 line-clamp-2 text-[13.5px] text-muted">
        {ws.summary || ws.description || "No description."}
      </p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
        {ws.page_count} pages · {ws.table_count} tables · {ws.file_count} files
      </p>
      <div className="mt-auto flex items-center justify-between pt-4 text-[12px] text-dim">
        <span>by {owner}</span>
        <span>★ {ws.fork_count}</span>
      </div>
    </Link>
  );
}
