"use client";

import { useState } from "react";

import { createView } from "../../lib/api";
import { useCollectTray } from "../../lib/collectTray";
import ShareSheet from "./ShareSheet";

/**
 * Persistent tray for bundling items across the app into a single shareable
 * View. Mounted globally in AppShell. Collapses to a small badge when empty
 * or hidden; expands to a list with reorder/remove + Share.
 */
export default function CollectTray() {
  const { items, remove, reorder, clear } = useCollectTray();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sharedView, setSharedView] = useState<{ id: string; title: string } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const onShare = async () => {
    if (items.length === 0) return;
    setCreating(true);
    setCreateError(null);
    try {
      const ws = items[0].workspace_id;
      const view = await createView(
        ws,
        title.trim() || `Bundle of ${items.length} item${items.length === 1 ? "" : "s"}`,
        items.map((it, i) => ({
          object_type: it.object_type,
          object_id: it.object_id,
          position: i,
        }))
      );
      setSharedView({ id: view.id, title: view.title });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create view");
    } finally {
      setCreating(false);
    }
  };

  const onShareSheetClose = () => {
    // Once the user dismisses the share sheet, clear the tray and reset.
    // The View is created and they have the link.
    setSharedView(null);
    setTitle("");
    clear();
  };

  if (items.length === 0 && !open) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="w-[340px] rounded-lg border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Collect tray · {items.length}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[14px] text-muted hover:text-foreground"
            >
              ×
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">
              Empty. Click <span className="font-mono">+ Collect</span> on any page, table, notebook, or session to start a bundle.
            </p>
          ) : (
            <>
              <ul className="max-h-[320px] overflow-y-auto px-2 py-2">
                {items.map((it, i) => (
                  <li
                    key={`${it.object_type}-${it.object_id}`}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== i) reorder(dragIdx, i);
                      setDragIdx(null);
                    }}
                    className="group flex items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-raised"
                  >
                    <span className="cursor-grab text-muted">⋮⋮</span>
                    <span className="font-mono text-[10px] uppercase text-muted">{it.object_type}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{it.label}</span>
                    <button
                      onClick={() => remove(it.object_type, it.object_id)}
                      className="text-muted opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              <div className="border-t border-border-subtle px-4 py-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Bundle title (default: "Bundle of ${items.length}")`}
                  className="mb-2 w-full rounded border border-border bg-raised px-2 py-1.5 text-[12px] text-foreground placeholder:text-muted"
                />
                {createError && (
                  <div className="mb-2 text-[11px] text-red-500">{createError}</div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => clear()}
                    disabled={creating}
                    className="text-[11px] text-muted hover:text-foreground disabled:opacity-50"
                  >
                    Clear all
                  </button>
                  <button
                    onClick={onShare}
                    disabled={creating || items.length === 0}
                    className="rounded border border-brand bg-brand/15 px-3 py-1 text-[12px] text-brand hover:bg-brand/25 disabled:opacity-50"
                  >
                    {creating ? "Creating…" : "Share bundle"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 shadow-lg hover:border-foreground"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider text-foreground">
            Collect
          </span>
          <span className="rounded-full bg-brand/20 px-1.5 text-[11px] font-medium text-brand">
            {items.length}
          </span>
        </button>
      )}

      {sharedView && (
        <div className="absolute bottom-0 right-0">
          <ShareSheet
            objectType="view"
            objectId={sharedView.id}
            objectLabel={sharedView.title}
            onClose={onShareSheetClose}
          />
        </div>
      )}
    </div>
  );
}
