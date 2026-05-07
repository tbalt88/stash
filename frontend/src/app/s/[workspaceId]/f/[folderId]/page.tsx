import Link from "next/link";
import { notFound } from "next/navigation";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

interface FolderDetail {
  folder: {
    id: string;
    name: string;
    parent_folder_id: string | null;
    workspace_id: string;
    updated_at: string;
  };
  subfolders: { id: string; name: string; updated_at: string }[];
  pages: {
    id: string;
    name: string;
    content_type: "markdown" | "html";
    updated_at: string;
  }[];
}

async function loadFolder(folderId: string): Promise<FolderDetail | null> {
  const res = await fetch(`${BACKEND_ORIGIN}/api/v1/public/folders/${folderId}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`folder fetch failed: ${res.status}`);
  return res.json();
}

export default async function PublicFolderPage({
  params,
}: {
  params: Promise<{ workspaceId: string; folderId: string }>;
}) {
  const { workspaceId, folderId } = await params;
  const detail = await loadFolder(folderId);
  if (!detail) notFound();
  const { folder, subfolders, pages } = detail;

  return (
    <main className="mx-auto max-w-[900px] px-7 py-12">
      <Link
        href={`/s/${workspaceId}`}
        className="font-mono text-[12px] uppercase tracking-wider text-muted hover:text-ink"
      >
        ← Workspace
      </Link>

      <header className="mt-6 border-b border-border-subtle pb-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Folder</p>
        <h1 className="mt-2 font-display text-[clamp(28px,3vw,40px)] font-black leading-[1.1] tracking-[-0.02em] text-ink">
          {folder.name}
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
          {subfolders.length} subfolder{subfolders.length === 1 ? "" : "s"} ·{" "}
          {pages.length} page{pages.length === 1 ? "" : "s"}
        </p>
      </header>

      {subfolders.length > 0 && (
        <ul className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
          {subfolders.map((f) => (
            <li key={f.id}>
              <Link
                href={`/s/${workspaceId}/f/${f.id}`}
                className="flex items-center justify-between gap-4 py-3 transition hover:bg-raised/40"
              >
                <span className="truncate text-[15px] text-ink">📁 {f.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
        {pages.length === 0 ? (
          <li className="py-4 text-[13px] text-muted">No pages in this folder.</li>
        ) : (
          pages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/s/${workspaceId}/p/${p.id}`}
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
