"use client";

import Link from "next/link";
import { useState, type DragEvent } from "react";
import { FolderIcon } from "../../StashIcons";
import type { FolderTreeNode, WorkspaceTree } from "../../../lib/types";
import { FB_DRAG_MIME, type FBDragPayload } from "./WorkspaceFileBrowser";

interface Props {
  workspaceId: string;
  tree: WorkspaceTree | null;
  activeFolderId: string | null;
  onReparent: (payload: FBDragPayload, targetFolderId: string | null) => Promise<void>;
}

export default function FolderTreePane({ workspaceId, tree, activeFolderId, onReparent }: Props) {
  return (
    <nav className="scroll-thin overflow-y-auto bg-surface/40 px-2 py-3 text-[13px]">
      <RootDrop
        workspaceId={workspaceId}
        active={activeFolderId === null}
        onReparent={onReparent}
      />
      {tree?.folders.map((folder) => (
        <TreeRow
          key={folder.id}
          workspaceId={workspaceId}
          node={folder}
          depth={0}
          activeFolderId={activeFolderId}
          onReparent={onReparent}
        />
      ))}
      {tree && tree.folders.length === 0 && (
        <div className="px-2 py-2 text-[11.5px] italic text-muted">No folders yet.</div>
      )}
    </nav>
  );
}

function RootDrop({
  workspaceId,
  active,
  onReparent,
}: {
  workspaceId: string;
  active: boolean;
  onReparent: (payload: FBDragPayload, targetFolderId: string | null) => Promise<void>;
}) {
  const [over, setOver] = useState(false);
  return (
    <Link
      href={`/workspaces/${workspaceId}/files`}
      className={
        "mb-1 flex items-center gap-2 rounded-md px-2 py-1 " +
        (active
          ? "bg-[var(--color-brand-50)] text-[var(--color-brand-800)]"
          : "text-dim hover:bg-raised hover:text-foreground") +
        (over ? " ring-2 ring-[var(--color-brand-300)]" : "")
      }
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(FB_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(FB_DRAG_MIME);
        setOver(false);
        if (!raw) return;
        e.preventDefault();
        try {
          onReparent(JSON.parse(raw) as FBDragPayload, null);
        } catch {
          /* malformed */
        }
      }}
    >
      <FolderIcon />
      <span className="font-medium">Files</span>
    </Link>
  );
}

function TreeRow({
  workspaceId,
  node,
  depth,
  activeFolderId,
  onReparent,
}: {
  workspaceId: string;
  node: FolderTreeNode;
  depth: number;
  activeFolderId: string | null;
  onReparent: (payload: FBDragPayload, targetFolderId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(activeFolderId === node.id || depth === 0);
  const [over, setOver] = useState(false);
  const active = activeFolderId === node.id;

  return (
    <div>
      <div
        className={
          "flex items-center gap-1 rounded-md px-1 py-0.5 " +
          (active
            ? "bg-[var(--color-brand-50)] text-[var(--color-brand-800)]"
            : "hover:bg-raised") +
          (over ? " ring-2 ring-[var(--color-brand-300)]" : "")
        }
        style={{ paddingLeft: 4 + depth * 12 }}
        // Drag source: drag a folder out of the tree to reparent it.
        draggable
        onDragStart={(e: DragEvent<HTMLDivElement>) => {
          const payload: FBDragPayload = { kind: "folder", id: node.id };
          e.dataTransfer.setData(FB_DRAG_MIME, JSON.stringify(payload));
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(FB_DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData(FB_DRAG_MIME);
          setOver(false);
          if (!raw) return;
          e.preventDefault();
          try {
            const payload = JSON.parse(raw) as FBDragPayload;
            if (payload.kind === "folder" && payload.id === node.id) return;
            onReparent(payload, node.id);
          } catch {
            /* malformed */
          }
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className="flex h-4 w-4 items-center justify-center rounded text-muted hover:bg-base/60 hover:text-foreground"
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {node.folders.length > 0 ? (
            <svg
              className={"h-3 w-3 transition-transform " + (open ? "rotate-90" : "")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <span className="block h-1 w-1 rounded-full bg-muted/40" />
          )}
        </button>
        <Link
          href={`/workspaces/${workspaceId}/folders/${node.id}`}
          className={
            "flex min-w-0 flex-1 items-center gap-1.5 truncate " +
            (active ? "font-medium" : "text-foreground")
          }
        >
          <FolderIcon />
          <span className="truncate">{node.name}</span>
        </Link>
      </div>
      {open &&
        node.folders.map((child) => (
          <TreeRow
            key={child.id}
            workspaceId={workspaceId}
            node={child}
            depth={depth + 1}
            activeFolderId={activeFolderId}
            onReparent={onReparent}
          />
        ))}
    </div>
  );
}
