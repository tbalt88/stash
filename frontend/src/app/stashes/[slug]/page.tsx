import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import HtmlPageView from "../../../components/workspace/HtmlPageView";
import AddToWorkspaceButton from "./AddToWorkspaceButton";

const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadStash(slug);
  if (!data) return { title: "Stash not found · Stash" };
  const title = `${data.stash.title} · Stash`;
  const description =
    data.stash.description ||
    `A Stash of ${data.items.length} item${data.items.length === 1 ? "" : "s"} from ${data.workspace_name}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `/stashes/${slug}`,
      siteName: "Stash",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

type StashItemInlined = {
  object_type: "folder" | "page" | "table" | "file" | "history" | "session";
  object_id: string;
  position: number;
  label: string;
  inline: Record<string, unknown>;
};

type PublicStash = {
  stash: {
    id: string;
    slug: string;
    title: string;
    description: string;
    cover_image_url: string | null;
    view_count: number;
    created_at: string;
    updated_at: string;
    workspace_id: string;
  };
  workspace_name: string;
  items: StashItemInlined[];
};

async function loadStash(slug: string): Promise<PublicStash | null> {
  // Permissions changes (revoke a share, flip an item to private) MUST take
  // effect immediately — caching the SSR response would let stale public
  // pages keep rendering after the publisher pulled access.
  const res = await fetch(`${BACKEND_ORIGIN}/api/v1/stashes/${slug}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`stash fetch failed: ${res.status}`);
  return res.json();
}

export default async function StashPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadStash(slug);
  if (!data) notFound();

  const { stash, workspace_name, items } = data;
  const groups = groupStashItems(items);
  const fileCount = (groups.folder?.length ?? 0) + (groups.page?.length ?? 0) + (groups.file?.length ?? 0);
  const sessionCount = (groups.session?.length ?? 0) + (groups.history?.length ?? 0);
  const tableCount = groups.table?.length ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-7 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {workspace_name}
            </p>
            <h1 className="truncate font-display text-[20px] font-bold text-ink">
              {stash.title}
            </h1>
          </div>
          <AddToWorkspaceButton slug={stash.slug} sourceWorkspaceId={stash.workspace_id} />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1180px] gap-8 px-7 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-6 space-y-1 text-[13px]">
            <a href="#home" className="block rounded-md px-2 py-1.5 font-medium text-foreground hover:bg-raised">
              Home
            </a>
            {fileCount > 0 ? (
              <a href="#files" className="block rounded-md px-2 py-1.5 text-dim hover:bg-raised hover:text-foreground">
                Files
              </a>
            ) : null}
            {sessionCount > 0 ? (
              <a href="#sessions" className="block rounded-md px-2 py-1.5 text-dim hover:bg-raised hover:text-foreground">
                Sessions
              </a>
            ) : null}
            {tableCount > 0 ? (
              <a href="#tables" className="block rounded-md px-2 py-1.5 text-dim hover:bg-raised hover:text-foreground">
                Tables
              </a>
            ) : null}
          </nav>
        </aside>

        <div className="min-w-0">
          <section id="home" className="scroll-mt-8 border-b border-border-subtle pb-8">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Public Stash · {items.length} item{items.length === 1 ? "" : "s"} · viewed{" "}
              {stash.view_count} time{stash.view_count === 1 ? "" : "s"}
            </p>
            <h2 className="mt-3 font-display text-[clamp(32px,4vw,48px)] font-black leading-[1.05] text-ink">
              Home
            </h2>
            <div className="mt-5 max-w-[760px] rounded-lg border border-border-subtle bg-surface p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                About this Stash
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground">
                {stash.description || "No description yet."}
              </p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <SummaryStat label="Files" value={fileCount} />
              <SummaryStat label="Sessions" value={sessionCount} />
              <SummaryStat label="Tables" value={tableCount} />
            </div>
          </section>

          <StashSection id="files" title="Files" items={[...(groups.folder ?? []), ...(groups.page ?? []), ...(groups.file ?? [])]} />
          <StashSection id="sessions" title="Sessions" items={[...(groups.session ?? []), ...(groups.history ?? [])]} />
          <StashSection id="tables" title="Tables" items={groups.table ?? []} />
        </div>
      </div>
    </main>
  );
}

function groupStashItems(items: StashItemInlined[]): Partial<Record<StashItemInlined["object_type"], StashItemInlined[]>> {
  const groups: Partial<Record<StashItemInlined["object_type"], StashItemInlined[]>> = {};
  for (const item of items) {
    groups[item.object_type] = [...(groups[item.object_type] ?? []), item];
  }
  return groups;
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-base px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-[20px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function StashSection({ id, title, items }: { id: string; title: string; items: StashItemInlined[] }) {
  if (items.length === 0) return null;
  return (
    <section id={id} className="scroll-mt-8 border-b border-border-subtle py-8 last:border-b-0">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-display text-[24px] font-bold text-ink">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {items.length}
        </span>
      </div>
      <div className="space-y-7">
        {items.map((item) => (
          <Item key={`${item.object_type}-${item.object_id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function Item({ item }: { item: StashItemInlined }) {
  return (
    <section id={`item-${item.object_type}-${item.object_id}`} className="scroll-mt-12">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded border border-border-subtle px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
          {item.object_type}
        </span>
        <h2 className="font-display text-[20px] font-bold text-ink">{item.label}</h2>
      </div>
      <div className="rounded-lg border border-border-subtle bg-surface p-5">
        <ItemBody item={item} />
      </div>
    </section>
  );
}

function ItemBody({ item }: { item: StashItemInlined }) {
  if (Object.keys(item.inline).length === 0) {
    return <p className="text-[13px] italic text-muted">This item is no longer available.</p>;
  }

  if (item.object_type === "folder") {
    const inline = item.inline as {
      pages?: {
        id: string;
        name: string;
        content_type?: "markdown" | "html";
        content_markdown: string;
        content_html?: string;
        html_layout?: "responsive" | "fixed-aspect";
      }[];
    };
    return (
      <div>
        {(inline.pages ?? []).map((p) => (
          <div key={p.id} className="mb-6 last:mb-0">
            <h3 className="font-display text-[16px] font-bold text-ink">{p.name}</h3>
            {p.content_type === "html" ? (
              <div className="mt-2">
                <HtmlPageView
                  html={p.content_html || ""}
                  title={p.name}
                  layout={p.html_layout}
                />
              </div>
            ) : (
              <div className="mt-2 markdown-content">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {p.content_markdown || "(empty)"}
                </Markdown>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (item.object_type === "page") {
    const inline = item.inline as {
      page?: {
        id: string;
        name: string;
        content_type?: "markdown" | "html";
        content_markdown: string;
        content_html?: string;
        html_layout?: "responsive" | "fixed-aspect";
      };
    };
    const p = inline.page;
    if (!p) return <p className="text-[13px] italic text-muted">This page is no longer available.</p>;
    return p.content_type === "html" ? (
      <HtmlPageView
        html={p.content_html || ""}
        title={p.name}
        layout={p.html_layout}
      />
    ) : (
      <div className="markdown-content">
        <Markdown remarkPlugins={[remarkGfm]}>
          {p.content_markdown || "(empty)"}
        </Markdown>
      </div>
    );
  }

  if (item.object_type === "table") {
    const inline = item.inline as {
      description?: string;
      columns?: { name: string; type: string }[];
      rows?: { data: Record<string, unknown> }[];
    };
    const cols = inline.columns ?? [];
    const rows = inline.rows ?? [];
    return (
      <div>
        {inline.description ? (
          <p className="mb-3 text-[14px] text-dim">{inline.description}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-subtle">
                {cols.map((c) => (
                  <th key={c.name} className="px-2 py-1 text-left font-mono text-[10px] uppercase text-muted">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border-subtle/50">
                  {cols.map((c) => (
                    <td key={c.name} className="px-2 py-1 text-foreground">
                      {String(r.data[c.name] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (item.object_type === "file") {
    const inline = item.inline as { content_type?: string; size_bytes?: number };
    return (
      <p className="text-[13px] text-dim">
        {inline.content_type} · {formatSize(inline.size_bytes ?? 0)}
      </p>
    );
  }

  if (item.object_type === "history") {
    const inline = item.inline as {
      agent_name?: string;
      event_type?: string;
      content?: string;
      created_at?: string;
    };
    return (
      <div>
        <p className="font-mono text-[11px] uppercase text-muted">
          {inline.agent_name} · {inline.event_type} · {inline.created_at}
        </p>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-background p-3 font-mono text-[12px] leading-[1.5] text-foreground">
          {inline.content || ""}
        </pre>
      </div>
    );
  }

  if (item.object_type === "session") {
    const inline = item.inline as {
      session?: {
        session_id: string;
        agent_name?: string;
        summary?: string | null;
        events?: {
          event_type: string;
          tool_name?: string | null;
          content: string;
          created_at: string;
        }[];
      };
    };
    const session = inline.session;
    if (!session) return <p className="text-[13px] italic text-muted">Session unavailable.</p>;
    return (
      <div className="space-y-4">
        <p className="font-mono text-[11px] uppercase text-muted">
          {session.agent_name || "Agent session"} · {session.session_id}
        </p>
        {session.summary ? (
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
            {session.summary}
          </p>
        ) : null}
        <div className="space-y-3">
          {(session.events ?? []).map((event, idx) => (
            <div key={`${event.created_at}-${idx}`} className="rounded-md border border-border-subtle bg-base p-3">
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase text-muted">
                <span>{event.event_type}</span>
                {event.tool_name ? <span>{event.tool_name}</span> : null}
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                {event.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
