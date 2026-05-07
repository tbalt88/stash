import Link from "next/link";

import type { CatalogCard } from "../../lib/api";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

type SearchParams = {
  q?: string;
  sort?: string;
  category?: string;
  tag?: string;
  tab?: "workspaces" | "views";
};

interface PublicViewCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  view_count: number;
  owner_name: string | null;
  owner_display_name: string | null;
  workspace_id: string;
  workspace_name: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

async function fetchCatalog(params: SearchParams): Promise<{ workspaces: CatalogCard[] }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ q: params.q, sort: params.sort, category: params.category, tag: params.tag })) {
    if (v) qs.set(k, v);
  }
  const res = await fetch(
    `${BACKEND_ORIGIN}/api/v1/discover/workspaces${qs.size ? `?${qs}` : ""}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return { workspaces: [] };
  return res.json();
}

async function fetchViews(params: SearchParams): Promise<{ views: PublicViewCard[] }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  const res = await fetch(
    `${BACKEND_ORIGIN}/api/v1/discover/views${qs.size ? `?${qs}` : ""}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { views: [] };
  return res.json();
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? "workspaces";
  const isViews = tab === "views";

  const sortOptions = isViews
    ? (["trending", "newest", "popular"] as const)
    : (["trending", "newest", "forks"] as const);
  const sort = (sortOptions as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as string)
    : sortOptions[0];

  const data = isViews
    ? await fetchViews({ ...params, sort })
    : await fetchCatalog({ ...params, sort });

  return (
    <main className="mx-auto max-w-[1200px] px-7 py-12">
      <h1 className="font-display text-[36px] font-black tracking-[-0.03em] text-ink">
        Discover
      </h1>
      <p className="mt-2 text-[15px] text-dim">
        {isViews
          ? "Curated Views — published bundles you can read or fork."
          : "Public Stashes you can read, fork, or join."}
      </p>

      <div className="mt-6 flex items-center gap-4 border-b border-border-subtle">
        {(["workspaces", "views"] as const).map((t) => (
          <Link
            key={t}
            href={`/discover?tab=${t}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
            className={
              "border-b-2 px-2 pb-2 text-[14px] transition " +
              (tab === t
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink")
            }
          >
            {t === "workspaces" ? "Stashes" : "Views"}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pb-2">
        {sortOptions.map((key) => (
          <Link
            key={key}
            href={`/discover?tab=${tab}&sort=${key}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
            className={`rounded-md px-3 py-1.5 text-[13px] transition ${
              sort === key ? "bg-raised text-ink" : "text-dim hover:bg-raised hover:text-ink"
            }`}
          >
            {key === "forks"
              ? "Most forked"
              : key === "popular"
              ? "Most viewed"
              : key.charAt(0).toUpperCase() + key.slice(1)}
          </Link>
        ))}
      </div>

      {isViews ? (
        <ViewsGrid views={(data as { views: PublicViewCard[] }).views} />
      ) : (
        <WorkspacesGrid workspaces={(data as { workspaces: CatalogCard[] }).workspaces} />
      )}
    </main>
  );
}

function WorkspacesGrid({ workspaces }: { workspaces: CatalogCard[] }) {
  if (workspaces.length === 0) {
    return <p className="mt-12 text-center text-[14px] text-muted">No public Stashes yet.</p>;
  }
  return (
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {workspaces.map((w) => (
        <WorkspaceCard key={w.id} ws={w} />
      ))}
    </div>
  );
}

function ViewsGrid({ views }: { views: PublicViewCard[] }) {
  if (views.length === 0) {
    return <p className="mt-12 text-center text-[14px] text-muted">No public Views yet.</p>;
  }
  return (
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {views.map((v) => (
        <ViewCard key={v.id} view={v} />
      ))}
    </div>
  );
}

function WorkspaceCard({ ws }: { ws: CatalogCard }) {
  const owner = ws.creator_display_name || ws.creator_name;
  return (
    <Link
      href={`/s/${ws.id}`}
      className="group flex flex-col rounded-xl border border-border-subtle bg-raised/30 p-5 transition hover:border-ink"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[18px] font-bold text-ink group-hover:text-brand">
          {ws.name}
        </h3>
        {ws.featured ? (
          <span className="rounded-md border border-brand/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-brand">
            Featured
          </span>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-[14px] text-dim">
        {ws.summary || ws.description || "No description yet."}
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

function ViewCard({ view }: { view: PublicViewCard }) {
  const owner = view.owner_display_name || view.owner_name || "—";
  return (
    <Link
      href={`/v/${view.slug}`}
      className="group flex flex-col rounded-xl border border-border-subtle bg-raised/30 p-5 transition hover:border-ink"
    >
      <h3 className="font-display text-[18px] font-bold text-ink group-hover:text-brand">
        {view.title}
      </h3>
      {view.description ? (
        <p className="mt-2 line-clamp-2 text-[14px] text-dim">{view.description}</p>
      ) : null}
      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
        {view.item_count} item{view.item_count === 1 ? "" : "s"} · from {view.workspace_name ?? "—"}
      </p>
      <div className="mt-auto flex items-center justify-between pt-4 text-[12px] text-dim">
        <span>by {owner}</span>
        <span>{view.view_count} view{view.view_count === 1 ? "" : "s"}</span>
      </div>
    </Link>
  );
}
