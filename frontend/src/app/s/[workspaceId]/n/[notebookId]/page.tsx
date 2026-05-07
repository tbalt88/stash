import Link from "next/link";
import { notFound } from "next/navigation";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

interface NotebookDetail {
  notebook: {
    id: string;
    name: string;
    description: string;
    workspace_id: string;
    updated_at: string;
  };
  pages: {
    id: string;
    name: string;
    content_type: "markdown" | "html";
    updated_at: string;
  }[];
}

async function loadNotebook(notebookId: string): Promise<NotebookDetail | null> {
  const res = await fetch(`${BACKEND_ORIGIN}/api/v1/public/notebooks/${notebookId}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`notebook fetch failed: ${res.status}`);
  return res.json();
}

export default async function PublicNotebookPage({
  params,
}: {
  params: Promise<{ workspaceId: string; notebookId: string }>;
}) {
  const { workspaceId, notebookId } = await params;
  const detail = await loadNotebook(notebookId);
  if (!detail) notFound();
  const { notebook, pages } = detail;

  return (
    <main className="mx-auto max-w-[900px] px-7 py-12">
      <Link
        href={`/s/${workspaceId}`}
        className="font-mono text-[12px] uppercase tracking-wider text-muted hover:text-ink"
      >
        ← Workspace
      </Link>

      <header className="mt-6 border-b border-border-subtle pb-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Notebook</p>
        <h1 className="mt-2 font-display text-[clamp(28px,3vw,40px)] font-black leading-[1.1] tracking-[-0.02em] text-ink">
          {notebook.name}
        </h1>
        {notebook.description ? (
          <p className="mt-3 max-w-[680px] text-[14px] text-foreground">{notebook.description}</p>
        ) : null}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
          {pages.length} page{pages.length === 1 ? "" : "s"}
        </p>
      </header>

      <ul className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
        {pages.length === 0 ? (
          <li className="py-4 text-[13px] text-muted">No pages.</li>
        ) : (
          pages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/s/${workspaceId}/n/${notebookId}/p/${p.id}`}
                className="flex items-center justify-between gap-4 py-3 transition hover:bg-raised/40"
              >
                <span className="truncate text-[15px] text-ink">{p.name}</span>
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted">
                  {p.content_type}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
