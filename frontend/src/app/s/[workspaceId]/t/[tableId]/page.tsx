import Link from "next/link";
import { notFound } from "next/navigation";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

interface PublicTable {
  table: {
    id: string;
    name: string;
    description: string;
    columns: { name: string; type: string }[];
    workspace_id: string;
    updated_at: string;
  };
  rows: { data: Record<string, unknown>; row_order: number }[];
}

async function loadTable(tableId: string): Promise<PublicTable | null> {
  const res = await fetch(`${BACKEND_ORIGIN}/api/v1/public/tables/${tableId}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`table fetch failed: ${res.status}`);
  return res.json();
}

export default async function PublicTablePage({
  params,
}: {
  params: Promise<{ workspaceId: string; tableId: string }>;
}) {
  const { workspaceId, tableId } = await params;
  const data = await loadTable(tableId);
  if (!data) notFound();
  const { table, rows } = data;

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-12">
      <Link
        href={`/s/${workspaceId}`}
        className="font-mono text-[12px] uppercase tracking-wider text-muted hover:text-ink"
      >
        ← Workspace
      </Link>

      <header className="mt-4 border-b border-border-subtle pb-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Table</p>
        <h1 className="mt-2 font-display text-[clamp(28px,3vw,40px)] font-black leading-[1.1] tracking-[-0.02em] text-ink">
          {table.name}
        </h1>
        {table.description ? (
          <p className="mt-3 max-w-[680px] text-[14px] text-foreground">{table.description}</p>
        ) : null}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted">
          {rows.length} row{rows.length === 1 ? "" : "s"} (capped at 500)
        </p>
      </header>

      <div className="mt-6 overflow-x-auto rounded border border-border-subtle">
        <table className="min-w-full text-[13px]">
          <thead className="bg-raised/40">
            <tr>
              {table.columns.map((c) => (
                <th
                  key={c.name}
                  className="border-b border-border-subtle px-3 py-2 text-left font-mono text-[10px] uppercase text-muted"
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border-subtle/60">
                {table.columns.map((c) => (
                  <td key={c.name} className="px-3 py-2 text-foreground">
                    {String(r.data[c.name] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
