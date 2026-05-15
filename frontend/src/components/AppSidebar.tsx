"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type DragEvent } from "react";
import { usePathname } from "next/navigation";
import {
  type FolderContents,
  type StashItemSpec,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspacePage,
  type WorkspaceSidebar,
  type WorkspaceSidebarSession,
  uploadFile,
  uploadTranscript,
} from "../lib/api";
import {
  getCachedFolderContents,
  getCachedWorkspaceSidebar,
  getCachedWorkspaces,
  readCachedFolderContents,
  readCachedSidebars,
  readCachedWorkspaces,
  refreshWorkspaceSidebar,
} from "../lib/stashNavigationCache";
import type { User, Workspace } from "../lib/types";
import {
  ActivityIcon,
  DiscoverIcon,
  FileIcon,
  FolderIcon,
  HelpIcon,
  PageIcon,
  SessionsIcon,
  SettingsIcon,
  StashIcon,
  TableIcon,
} from "./StashIcons";

interface AppSidebarProps {
  user?: User;
  onLogout?: () => void;
  cmdkOpen?: boolean;
  onCmdkOpen?: () => void;
  activeWorkspaceId?: string | null;
}

interface WorkspaceNode extends Workspace {
  shared?: boolean;
}

type SidebarSection = "sessions" | "files" | "stashes";
type DropSection = "sessions" | "files";
type DropStatus = "idle" | "over" | "saving" | "done" | "error";

interface SidebarDropState {
  key: string | null;
  status: DropStatus;
  message: string;
}

const OPEN_WORKSPACES_KEY = "stash_sidebar_open_workspaces";
const OPEN_SECTIONS_KEY = "stash_sidebar_open_sections";
const PREVIEW_ITEM_LIMIT = 10;

function readOpenMap(key: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(key);
  if (!raw) return {};

  return JSON.parse(raw);
}

function writeOpenMap(key: string, value: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function sectionKey(workspaceId: string, section: SidebarSection): string {
  return `${workspaceId}:${section}`;
}

function dropKey(workspaceId: string, section: DropSection): string {
  return `${workspaceId}:${section}`;
}

function isFilesDrag(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function isJsonl(file: File): boolean {
  return file.name.toLowerCase().endsWith(".jsonl");
}

function sessionIdFromFile(file: File): string {
  return file.name.replace(/\.jsonl$/i, "").trim();
}

function ChevronToggle({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className="-ml-0.5 flex h-4 w-4 items-center justify-center rounded text-muted hover:bg-base/60 hover:text-foreground"
      aria-label="Toggle"
    >
      <svg
        className="chev h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function NavRow({
  href,
  icon,
  label,
  active,
  trailing,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "page-row flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors " +
        (active
          ? "bg-[var(--color-brand-50)] text-[var(--color-brand-800)]"
          : "text-dim hover:bg-raised hover:text-foreground")
      }
    >
      <span className="flex h-4 w-4 items-center justify-center text-[14px]">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

function WorkspaceTree({
  workspace,
  spine,
  showName,
  pathname,
  openSections,
  onSectionOpenChange,
  dropState,
  onDropFiles,
  onDropHover,
}: {
  workspace: WorkspaceNode;
  spine: WorkspaceSidebar | null;
  showName?: boolean;
  pathname: string;
  openSections: Record<SidebarSection, boolean>;
  onSectionOpenChange: (section: SidebarSection, open: boolean) => void;
  dropState: SidebarDropState;
  onDropFiles: (workspaceId: string, section: DropSection, files: FileList) => void;
  onDropHover: (workspaceId: string, section: DropSection, active: boolean) => void;
}) {
  const dropProps = (section: DropSection) => ({
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!isFilesDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      onDropHover(workspace.id, section, true);
    },
    onDragLeave(event: DragEvent<HTMLElement>) {
      if (!isFilesDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      onDropHover(workspace.id, section, false);
    },
    onDrop(event: DragEvent<HTMLElement>) {
      if (!isFilesDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      onDropFiles(workspace.id, section, event.dataTransfer.files);
    },
  });
  const sessionsDrop = dropState.key === dropKey(workspace.id, "sessions") ? dropState : null;

  return (
      <div className="space-y-0.5">
      {showName && (
        <NavRow
          href={`/workspaces/${workspace.id}`}
          icon={<StashIcon />}
          label={workspace.name}
          active={pathname === `/workspaces/${workspace.id}`}
        />
      )}
      <details
        open={openSections.sessions}
        onToggle={(e) => onSectionOpenChange("sessions", e.currentTarget.open)}
        className="text-[13px]"
        {...dropProps("sessions")}
        >
          <summary
            onClick={(e) => e.preventDefault()}
            className={
              "page-row flex items-center gap-1 rounded-md px-2 py-1 hover:bg-raised " +
              (sessionsDrop?.status === "over"
                ? "bg-[var(--color-brand-50)] text-[var(--color-brand-800)] ring-1 ring-[var(--color-brand-300)]"
                : "")
            }
          >
            <ChevronToggle
              onToggle={() => onSectionOpenChange("sessions", !openSections.sessions)}
            />
            <span className="flex h-4 w-4 items-center justify-center text-[14px] text-muted">
              <SessionsIcon />
            </span>
            <Link
              href={`/workspaces/${workspace.id}/sessions`}
              className="flex-1 truncate font-medium text-foreground hover:text-[var(--color-brand-700)]"
            >
              Sessions
            </Link>
            <span className="text-[10.5px] text-muted">{spine?.sessions.length ?? 0}</span>
          </summary>
        <div className="ml-3 space-y-0.5 border-l border-border pl-2">
            {sessionsDrop?.message ? <DropMessage state={sessionsDrop} /> : null}
            {groupSidebarSessions(spine?.sessions ?? []).map((group) => (
              <SessionTreeDetails
                key={group.dateKey}
                workspaceId={workspace.id}
                group={group}
              />
            ))}
            {(!spine || spine.sessions.length === 0) && (
              <div className="px-2 py-1 text-[11px] italic text-muted">empty</div>
            )}
          </div>
        </details>

        <FilesBlock
          workspace={workspace}
          spine={spine}
          open={openSections.files}
          onOpenChange={(nextOpen) => onSectionOpenChange("files", nextOpen)}
          dropState={dropState}
          dropProps={dropProps("files")}
        />
        <StashesBlock
          workspace={workspace}
          spine={spine}
          open={openSections.stashes}
          onOpenChange={(nextOpen) => onSectionOpenChange("stashes", nextOpen)}
        />
    </div>
  );
}

function fileIconClass(contentType: string | undefined): string {
  if (contentType?.includes("pdf")) return "text-rose-500";
  if (contentType?.includes("csv")) return "text-emerald-600";
  if (contentType?.includes("html")) return "text-amber-600";
  return "text-muted";
}

function sessionLabelForSidebar(session: WorkspaceSidebarSession): string {
  const raw = (session.title || session.session_id).trim();
  return raw.length > 26 ? `${raw.slice(0, 26)}…` : raw;
}

type SessionTreeDayGroup = {
  dateKey: string;
  label: string;
  total: number;
  users: Array<{ user: string; sessions: WorkspaceSidebarSession[] }>;
};

const UNKNOWN_SESSION_DATE = "Unknown date";

function sessionDateKey(iso: string | null | undefined): string {
  if (!iso) return UNKNOWN_SESSION_DATE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return UNKNOWN_SESSION_DATE;
  return date.toISOString().slice(0, 10);
}

function formatSessionDateKey(key: string): string {
  if (key === UNKNOWN_SESSION_DATE) return key;
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupSidebarSessions(sessions: WorkspaceSidebarSession[]): SessionTreeDayGroup[] {
  const byDate = new Map<string, Map<string, WorkspaceSidebarSession[]>>();
  for (const session of sessions) {
    const dateKey = sessionDateKey(session.last_at || session.updated_at);
    const user = (session.agent_name || "Unknown user").trim() || "Unknown user";
    const users = byDate.get(dateKey) ?? new Map<string, WorkspaceSidebarSession[]>();
    users.set(user, [...(users.get(user) ?? []), session]);
    byDate.set(dateKey, users);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => {
      if (a === UNKNOWN_SESSION_DATE) return 1;
      if (b === UNKNOWN_SESSION_DATE) return -1;
      return b.localeCompare(a);
    })
    .map(([dateKey, usersByName]) => {
      const users = Array.from(usersByName.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([user, sessionRows]) => ({
          user,
          sessions: sessionRows,
        }));
      const total = users.reduce((sum, bucket) => sum + bucket.sessions.length, 0);
      return {
        dateKey,
        label: formatSessionDateKey(dateKey),
        total,
        users,
      };
    });
}

function SessionTreeDetails({
  workspaceId,
  group,
}: {
  workspaceId: string;
  group: SessionTreeDayGroup;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details open={open} className="text-[12.5px]">
      <summary
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((current) => !current);
        }}
        className="page-row flex items-center gap-1 rounded-md px-2 py-1 hover:bg-raised"
      >
        <ChevronToggle onToggle={() => setOpen((current) => !current)} />
        <span className="flex h-4 w-4 items-center justify-center text-[14px] text-muted">
          <FolderIcon />
        </span>
        <span className="flex-1 truncate text-foreground">{group.label}</span>
        <span className="text-[10.5px] text-muted">{group.total}</span>
      </summary>
      <div className="ml-2.5 space-y-0.5 border-l border-border pl-2">
        {group.users.length === 0 ? (
          <div className="px-2 py-1 text-[11px] italic text-muted">no sessions</div>
        ) : (
          group.users.map((bucket) => (
            <SessionUserFolder
              key={`${group.dateKey}-${bucket.user}`}
              workspaceId={workspaceId}
              bucket={bucket}
            />
          ))
        )}
      </div>
    </details>
  );
}

function SessionUserFolder({
  workspaceId,
  bucket,
}: {
  workspaceId: string;
  bucket: { user: string; sessions: WorkspaceSidebarSession[] };
}) {
  const [open, setOpen] = useState(false);
  return (
    <details open={open} className="text-[12px]">
      <summary
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((current) => !current);
        }}
        className="page-row flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-raised"
      >
        <ChevronToggle onToggle={() => setOpen((current) => !current)} />
        <span className="flex h-4 w-4 items-center justify-center text-[13px] text-muted">
          <SessionsIcon />
        </span>
        <span className="flex-1 truncate text-muted">{bucket.user}</span>
        <span className="text-[10px] text-muted">{bucket.sessions.length}</span>
      </summary>
      <div className="ml-2.5 space-y-0.5 border-l border-border pl-2">
        {bucket.sessions.map((s) => (
          <NavRow
            key={s.session_id}
            href={`/workspaces/${workspaceId}/sessions/${encodeURIComponent(s.session_id)}`}
            icon={<span className="text-muted"><SessionsIcon /></span>}
            label={sessionLabelForSidebar(s)}
          />
        ))}
      </div>
    </details>
  );
}

type StashTreeKind = "session" | "folder" | "page" | "file" | "table" | "other";

type StashTreeItem = {
  kind: StashTreeKind;
  key: string;
  href?: string;
  label: string;
  icon: React.ReactNode;
};

function resolveFolderPath(
  folderId: string | null,
  foldersById: Map<string, WorkspaceFolder>,
  cache: Map<string, string>,
  stack = new Set<string>()
): string {
  if (!folderId) return "";
  const cached = cache.get(folderId);
  if (cached !== undefined) return cached;
  if (stack.has(folderId)) return "";
  const folder = foldersById.get(folderId);
  if (!folder) return "";

  stack.add(folderId);
  const parentPath = resolveFolderPath(folder.parent_folder_id, foldersById, cache, stack);
  const next = parentPath ? `${parentPath}/${folder.name}` : folder.name;
  cache.set(folderId, next);
  return next;
}

function buildStashTreeItems(
  workspaceId: string,
  items: StashItemSpec[],
  folderById: Map<string, WorkspaceFolder>,
  pageById: Map<string, WorkspacePage>,
  fileById: Map<string, WorkspaceFile>,
  sessionById: Map<string, WorkspaceSidebarSession>,
  sessionBySessionId: Map<string, WorkspaceSidebarSession>
): StashTreeItem[] {
  const pathCache = new Map<string, string>();
  return [...items]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((item, index) => {
      if (item.object_type === "session") {
        const session = sessionById.get(item.object_id) ?? sessionBySessionId.get(item.object_id);
        const fallback = `Session ${item.object_id}`;
        return {
          kind: "session",
          key: `${item.object_id}:${index}`,
          href: session ? `/workspaces/${workspaceId}/sessions/${encodeURIComponent(session.session_id)}` : undefined,
          icon: <span className="text-muted"><SessionsIcon /></span>,
          label: item.label_override ?? (session ? session.title || session.session_id : fallback),
        };
      }

      if (item.object_type === "folder") {
        const folder = folderById.get(item.object_id);
        return {
          kind: "folder",
          key: `${item.object_id}:${index}`,
          href: folder ? `/workspaces/${workspaceId}/folders/${item.object_id}` : undefined,
          icon: <span className="text-muted"><FolderIcon /></span>,
          label:
            item.label_override ??
            (folder ? resolveFolderPath(folder.id, folderById, pathCache) : `Folder ${item.object_id}`),
        };
      }

      if (item.object_type === "page") {
        const page = pageById.get(item.object_id);
        if (!page) {
          return {
            kind: "page",
            key: `${item.object_id}:${index}`,
            icon: <span className="text-muted"><PageIcon /></span>,
            label: item.label_override ?? `Page ${item.object_id}`,
          };
        }

        const folderPath = resolveFolderPath(page.folder_id, folderById, pathCache);
        const pagePath = folderPath ? `${folderPath}/${page.name}` : page.name;
        return {
          kind: "page",
          key: `${item.object_id}:${index}`,
          href: `/workspaces/${workspaceId}/p/${page.id}`,
          icon: <span className="text-muted"><PageIcon /></span>,
          label: item.label_override ?? pagePath,
        };
      }

      if (item.object_type === "file") {
        const file = fileById.get(item.object_id);
        if (!file) {
          return {
            kind: "file",
            key: `${item.object_id}:${index}`,
            icon: <span className={fileIconClass(undefined)}><FileIcon /></span>,
            label: item.label_override ?? `File ${item.object_id}`,
          };
        }

        const folderPath = resolveFolderPath(file.folder_id, folderById, pathCache);
        const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;
        return {
          kind: "file",
          key: `${item.object_id}:${index}`,
          href: `/workspaces/${workspaceId}/f/${file.id}`,
          icon: <span className={fileIconClass(file.content_type)}><FileIcon /></span>,
          label: item.label_override ?? filePath,
        };
      }

      if (item.object_type === "table") {
        return {
          kind: "table",
          key: `${item.object_id}:${index}`,
          href: `/tables/${item.object_id}?workspaceId=${workspaceId}`,
          icon: <span className="text-muted"><TableIcon /></span>,
          label: item.label_override ?? `Table ${item.object_id}`,
        };
      }

      return {
        kind: "other",
        key: `${item.object_id}:${index}`,
        icon: <span className="text-muted"><FolderIcon /></span>,
        label: item.label_override ?? `${item.object_type} ${item.object_id}`,
      };
    });
}

function StashTreeRow({ row }: { row: StashTreeItem }) {
  if (!row.href) {
    return (
      <div className="page-row flex items-center gap-2 rounded-md px-2 py-0.5 text-[12.5px] text-muted">
        <span className="flex h-4 w-4 items-center justify-center text-[14px]">{row.icon}</span>
        <span className="flex-1 truncate">{row.label}</span>
      </div>
    );
  }

  return (
    <NavRow href={row.href} icon={row.icon} label={row.label} />
  );
}

function FileNavRow({
  workspaceId,
  file,
}: {
  workspaceId: string;
  file: Pick<WorkspaceFile, "id" | "name" | "content_type" | "linked_table_id">;
}) {
  const isCsvLinked =
    file.content_type?.includes("csv") && file.linked_table_id;
  const href = isCsvLinked
    ? `/tables/${file.linked_table_id}?workspaceId=${workspaceId}`
    : `/workspaces/${workspaceId}/f/${file.id}`;
  return (
    <NavRow
      href={href}
      icon={
        <span className={fileIconClass(file.content_type)}>
          {file.content_type?.includes("csv") ? <TableIcon /> : <FileIcon />}
        </span>
      }
      label={file.name}
    />
  );
}

function DropMessage({ state }: { state: SidebarDropState }) {
  const tone =
    state.status === "error"
      ? "text-red-600"
      : state.status === "done"
        ? "text-[var(--color-brand-700)]"
        : "text-muted";

  return (
    <div className={"px-2 py-1 text-[11px] " + tone}>
      {state.message}
    </div>
  );
}

function FolderTreeNode({
  workspaceId,
  folderId,
  name,
}: {
  workspaceId: string;
  folderId: string;
  name: string;
}) {
  const cachedContents = readCachedFolderContents(folderId);
  const [contents, setContents] = useState<FolderContents | null>(cachedContents);
  const [loaded, setLoaded] = useState(!!cachedContents);
  const [open, setOpen] = useState(false);

  const handleToggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoaded(true);
      getCachedFolderContents(workspaceId, folderId)
        .then(setContents)
        .catch(() =>
          setContents({
            folder: { id: folderId, name, parent_folder_id: null },
            breadcrumbs: [],
            subfolders: [],
            pages: [],
            files: [],
          })
        );
    }
  }, [open, loaded, workspaceId, folderId, name]);

  return (
    <details open={open} className="text-[12.5px]">
      <summary
        onClick={(e) => e.preventDefault()}
        className="page-row flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-raised"
      >
        <ChevronToggle onToggle={handleToggle} />
        <span className="flex h-4 w-4 items-center justify-center text-muted">
          <FolderIcon />
        </span>
        <Link
          href={`/workspaces/${workspaceId}/folders/${folderId}`}
          className="flex-1 truncate text-left text-foreground hover:text-[var(--color-brand-700)]"
        >
          {name}
        </Link>
      </summary>
      <div className="ml-2.5 space-y-0.5 border-l border-border pl-2">
        {contents === null && loaded && (
          <div className="px-2 py-1 text-[11px] italic text-muted">loading…</div>
        )}
        {contents?.subfolders.map((sub) => (
          <FolderTreeNode
            key={sub.id}
            workspaceId={workspaceId}
            folderId={sub.id}
            name={sub.name}
          />
        ))}
        {contents?.pages.map((p) => (
          <NavRow
            key={p.id}
            href={`/workspaces/${workspaceId}/p/${p.id}`}
            icon={<PageIcon className="text-muted" />}
            label={p.name}
          />
        ))}
        {contents?.files.map((f) => (
          <FileNavRow key={f.id} workspaceId={workspaceId} file={f} />
        ))}
        {contents &&
          contents.subfolders.length === 0 &&
          contents.pages.length === 0 &&
          contents.files.length === 0 && (
            <div className="px-2 py-1 text-[11px] italic text-muted">empty</div>
          )}
      </div>
    </details>
  );
}

function FilesBlock({
  workspace,
  spine,
  open,
  onOpenChange,
  dropState,
  dropProps,
}: {
  workspace: WorkspaceNode;
  spine: WorkspaceSidebar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dropState: SidebarDropState;
  dropProps: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
}) {
  const tree = spine?.files;
  const folders = tree?.folders ?? [];
  const pages = tree?.pages ?? [];
  const files = tree?.files ?? [];
  const rootFolders = folders.filter((f) => !f.parent_folder_id);
  const rootPages = pages.filter((p) => !p.folder_id);
  const rootFiles = files.filter((f) => !f.folder_id);
  const total = folders.length + pages.length + files.length;
  const filesDrop = dropState.key === dropKey(workspace.id, "files") ? dropState : null;
  return (
    <details
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className="text-[13px]"
      {...dropProps}
    >
      <summary
        onClick={(e) => {
          e.preventDefault();
          onOpenChange(!open);
        }}
        className={
          "page-row flex items-center gap-1 rounded-md px-2 py-1 hover:bg-raised " +
          (filesDrop?.status === "over"
            ? "bg-[var(--color-brand-50)] text-[var(--color-brand-800)] ring-1 ring-[var(--color-brand-300)]"
            : "")
        }
      >
        <ChevronToggle onToggle={() => onOpenChange(!open)} />
        <span className="flex h-4 w-4 items-center justify-center text-[14px] text-muted">
          <FileIcon />
        </span>
        <span className="flex-1 truncate font-medium text-foreground">Files</span>
        <span className="text-[10.5px] text-muted">{total}</span>
      </summary>
      <div className="ml-3 space-y-0.5 border-l border-border pl-2">
        {filesDrop?.message ? <DropMessage state={filesDrop} /> : null}
        {rootFolders.map((f) => (
          <FolderTreeNode
            key={f.id}
            workspaceId={workspace.id}
            folderId={f.id}
            name={f.name}
          />
        ))}
        {rootPages.slice(0, PREVIEW_ITEM_LIMIT).map((p) => (
          <NavRow
            key={p.id}
            href={`/workspaces/${workspace.id}/p/${p.id}`}
            icon={<PageIcon className="text-muted" />}
            label={p.name}
          />
        ))}
        {rootFiles.slice(0, PREVIEW_ITEM_LIMIT).map((f) => (
          <FileNavRow key={f.id} workspaceId={workspace.id} file={f} />
        ))}
        {!spine || total === 0 ? (
          <div className="px-2 py-1 text-[11px] italic text-muted">empty</div>
        ) : null}
      </div>
    </details>
  );
}

function StashesBlock({
  workspace,
  spine,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceNode;
  spine: WorkspaceSidebar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const stashes = spine?.stashes ?? [];
  const tree = spine?.files;
  const foldersById = new Map(
    (tree?.folders ?? []).map((folder) => [folder.id, folder])
  );
  const pagesById = new Map(
    (tree?.pages ?? []).map((page) => [page.id, page])
  );
  const filesById = new Map(
    (tree?.files ?? []).map((file) => [file.id, file])
  );

  const sessionById = new Map<string, WorkspaceSidebarSession>();
  const sessionBySessionId = new Map<string, WorkspaceSidebarSession>();
  for (const session of spine?.sessions ?? []) {
    if (session.id) sessionById.set(session.id, session);
    sessionBySessionId.set(session.session_id, session);
  }

  const internalStashes = stashes.filter((stash) => !stash.is_external);
  const externalStashes = stashes.filter((stash) => stash.is_external);

  function renderStashGroup(
    title: string,
    items: typeof stashes,
    includeEmpty = false
  ) {
    if (items.length === 0 && !includeEmpty) return null;

    return (
      <div className="space-y-0.5 border-l border-border pl-2">
        <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {title} {items.length}
        </div>
        {items.length === 0 ? (
          <div className="px-2 py-1 text-[11px] italic text-muted">empty</div>
        ) : (
          items.map((stash) => (
            <div key={`${title}-${stash.id}`} className="space-y-0.5">
              <NavRow
                href={`/stashes/${stash.slug}`}
                icon={<StashIcon />}
                label={stash.title}
                trailing={<span className="text-[10px] text-muted">{stash.items?.length ?? stash.item_count}</span>}
              />
              <div className="ml-2.5 space-y-0.5 border-l border-border pl-2">
                {(() => {
                  const children = buildStashTreeItems(
                    workspace.id,
                    stash.items ?? [],
                    foldersById,
                    pagesById,
                    filesById,
                    sessionById,
                    sessionBySessionId
                  );
                  const sessions = children.filter((item) => item.kind === "session");
                  const files = children.filter((item) => item.kind !== "session");
                  if (children.length === 0) {
                    return (
                      <div className="px-2 py-1 text-[11px] italic text-muted">
                        no visible items
                      </div>
                    );
                  }
                  return (
                    <>
                      {sessions.length > 0 ? (
                        <>
                          <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">sessions</div>
                          {sessions.map((item) => (
                            <StashTreeRow key={`session:${item.key}`} row={item} />
                          ))}
                        </>
                      ) : null}
                      {files.length > 0 ? (
                        <>
                          <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">files</div>
                          {files.map((item) => (
                            <StashTreeRow key={`files:${item.key}`} row={item} />
                          ))}
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <details
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className="text-[13px]"
    >
      <summary
        onClick={(e) => {
          e.preventDefault();
          onOpenChange(!open);
        }}
        className="page-row flex items-center gap-1 rounded-md px-2 py-1 hover:bg-raised"
      >
        <ChevronToggle onToggle={() => onOpenChange(!open)} />
        <span className="flex h-4 w-4 items-center justify-center text-[14px] text-muted">
          <StashIcon />
        </span>
        <Link
          href={`/workspaces/${workspace.id}/stashes`}
          className="flex-1 truncate font-medium text-foreground hover:text-[var(--color-brand-700)]"
        >
          Stashes
        </Link>
        <span className="text-[10.5px] text-muted">{stashes.length}</span>
      </summary>
      <div className="ml-3 space-y-0.5 border-l border-border pl-2">
        {internalStashes.length === 0 && externalStashes.length === 0 ? (
          <div className="px-2 py-1 text-[11px] italic text-muted">empty</div>
        ) : null}
        {renderStashGroup("Workspace", internalStashes, false)}
        {renderStashGroup("External", externalStashes, false)}
      </div>
    </details>
  );
}

export default function AppSidebar({
  user,
  onCmdkOpen,
  activeWorkspaceId,
}: AppSidebarProps) {
  const pathname = usePathname();
  const userId = user?.id;
  const cachedWorkspaces = readCachedWorkspaces(userId);
  const activeTreeMatch = pathname.match(
    /^\/workspaces\/([^/]+)\/(sessions|folders|p|f|stashes)(?:\/|$)/
  );
  const activeTreeWorkspaceId = activeTreeMatch?.[1] ?? null;
  const activeTreeSection: SidebarSection | null =
    activeTreeMatch?.[2] === "sessions"
      ? "sessions"
      : activeTreeMatch?.[2] === "stashes"
        ? "stashes"
      : activeTreeMatch
        ? "files"
        : null;
  const [mine, setMine] = useState<Workspace[]>(cachedWorkspaces?.mine ?? []);
  const [shared, setShared] = useState<Workspace[]>(cachedWorkspaces?.shared ?? []);
  const [openWorkspaces] = useState<Record<string, boolean>>(() =>
    readOpenMap(OPEN_WORKSPACES_KEY)
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    readOpenMap(OPEN_SECTIONS_KEY)
  );
  const [spines, setSpines] = useState<Record<string, WorkspaceSidebar>>(() =>
    readCachedSidebars()
  );
  const [dropState, setDropState] = useState<SidebarDropState>({
    key: null,
    status: "idle",
    message: "",
  });

  useEffect(() => {
    if (!userId) return;

    getCachedWorkspaces(userId)
      .then((r) => {
        setMine(r.mine);
        setShared(r.shared);
      })
      .catch(() => {});
  }, [userId]);

  const setOpenSection = useCallback((
    workspaceId: string,
    section: SidebarSection,
    open: boolean
  ) => {
    setOpenSections((current) => {
      const next = { ...current, [sectionKey(workspaceId, section)]: open };
      writeOpenMap(OPEN_SECTIONS_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const openIds = Object.keys(openWorkspaces).filter((workspaceId) => openWorkspaces[workspaceId]);
    if (activeTreeWorkspaceId) openIds.push(activeTreeWorkspaceId);

    Array.from(new Set(openIds))
      .filter((workspaceId) => !spines[workspaceId])
      .forEach((workspaceId) => {
        getCachedWorkspaceSidebar(workspaceId)
          .then((sp) => setSpines((all) => ({ ...all, [workspaceId]: sp })))
          .catch(() => {});
      });
  }, [activeTreeWorkspaceId, openWorkspaces, spines]);

  function sectionOpen(workspaceId: string, section: SidebarSection): boolean {
    // Explicit user preference (open or closed) wins. Otherwise default open.
    const explicit = openSections[sectionKey(workspaceId, section)];
    if (explicit !== undefined) return explicit;
    return true;
  }

  function getOpenSections(workspaceId: string): Record<SidebarSection, boolean> {
    return {
      sessions: sectionOpen(workspaceId, "sessions"),
      files: sectionOpen(workspaceId, "files"),
      stashes: sectionOpen(workspaceId, "stashes"),
    };
  }

  function handleSectionOpenChange(
    workspaceId: string,
    section: SidebarSection,
    open: boolean
  ) {
    const explicit = openSections[sectionKey(workspaceId, section)];
    const routeOpen =
      activeTreeWorkspaceId === workspaceId && activeTreeSection === section;
    if (open && routeOpen && explicit === undefined) return;
    setOpenSection(workspaceId, section, open);
  }

  function clearDropLater(workspaceId: string, section: DropSection) {
    window.setTimeout(() => {
      setDropState((current) =>
        current.key === dropKey(workspaceId, section)
          ? { key: null, status: "idle", message: "" }
          : current
      );
    }, 2500);
  }

  function handleDropHover(workspaceId: string, section: DropSection, active: boolean) {
    const key = dropKey(workspaceId, section);
    setDropState((current) => {
      if (!active && current.key === key && current.status === "over") {
        return { key: null, status: "idle", message: "" };
      }
      if (!active) return current;
      return {
        key,
        status: "over",
        message:
          section === "sessions"
            ? "Drop .JSONL transcript files"
            : "Drop files (any type)",
      };
    });
  }

  async function refreshSidebar(workspaceId: string) {
    const sidebar = await refreshWorkspaceSidebar(workspaceId);
    setSpines((all) => ({ ...all, [workspaceId]: sidebar }));
  }

  async function handleDropFiles(workspaceId: string, section: DropSection, files: FileList) {
    const list = Array.from(files);
    const key = dropKey(workspaceId, section);
    if (list.length === 0) return;

    if (section === "sessions") {
      const badFile = list.find((file) => !isJsonl(file));
      if (badFile) {
        setDropState({
          key,
          status: "error",
          message: "Sessions only accept .jsonl transcripts.",
        });
        clearDropLater(workspaceId, section);
        return;
      }

      const badSession = list.find((file) => !sessionIdFromFile(file));
      if (badSession) {
        setDropState({
          key,
          status: "error",
          message: "Transcript filename must include a session id.",
        });
        clearDropLater(workspaceId, section);
        return;
      }
    }

    setDropState({
      key,
      status: "saving",
      message: list.length === 1 ? `Uploading ${list[0].name}...` : `Uploading ${list.length} files...`,
    });

    try {
      if (section === "sessions") {
        for (const file of list) {
          await uploadTranscript(workspaceId, file, sessionIdFromFile(file), "manual-upload");
        }
      } else {
        for (const file of list) {
          await uploadFile(workspaceId, file);
        }
      }
      await refreshSidebar(workspaceId);
    } catch (error) {
      setDropState({
        key,
        status: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
      clearDropLater(workspaceId, section);
      return;
    }

    setDropState({
      key,
      status: "done",
      message:
        section === "sessions"
          ? `${list.length} session${list.length === 1 ? "" : "s"} added.`
          : `${list.length} file${list.length === 1 ? "" : "s"} added.`,
    });
    clearDropLater(workspaceId, section);
  }

  return (
    <aside className="scroll-thin overflow-y-auto border-r border-border bg-surface">
      <div className="px-3 pb-1 pt-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/octopus.svg" alt="Stash" className="h-7 w-7" />
          <span className="font-display text-[14px] font-semibold tracking-tight text-foreground">
            stash
          </span>
        </Link>
      </div>

      <nav className="px-2 pt-2 text-[13px]">
        <button
          onClick={onCmdkOpen}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-muted hover:bg-raised"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Search
          <span className="ml-auto rounded bg-base px-1 py-0 font-mono text-[10px] text-muted ring-1 ring-border">
            ⌘K
          </span>
        </button>
        <NavRow
          href={activeWorkspaceId ? `/workspaces/${activeWorkspaceId}` : "/"}
          icon={<StashIcon />}
          label="Home"
          active={
            activeWorkspaceId
              ? pathname.startsWith(`/workspaces/${activeWorkspaceId}`)
              : pathname === "/"
          }
        />
        <NavRow
          href="/discover"
          icon={<DiscoverIcon />}
          label="Discover"
          active={pathname.startsWith("/discover")}
        />
        <NavRow
          href="/activity"
          icon={<ActivityIcon />}
          label="Activity"
          active={pathname.startsWith("/activity")}
        />
      </nav>

      {shared.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between px-3 pb-1">
            <span className="text-[11px] font-semibold tracking-wide text-muted">
              SHARED WORKSPACES
            </span>
          </div>
          <nav className="px-1 text-[13.5px]">
            {shared.map((s) => (
              <WorkspaceTree
                key={s.id}
                workspace={{ ...s, shared: true }}
                spine={spines[s.id] ?? null}
                showName
                pathname={pathname}
                openSections={getOpenSections(s.id)}
                onSectionOpenChange={(section, open) =>
                  handleSectionOpenChange(s.id, section, open)
                }
                dropState={dropState}
                onDropFiles={handleDropFiles}
                onDropHover={handleDropHover}
              />
            ))}
          </nav>
        </>
      )}

      <nav className="mt-4 px-1 text-[13.5px]">
        {mine.map((s) => (
          <WorkspaceTree
            key={s.id}
            workspace={s}
            spine={spines[s.id] ?? null}
            pathname={pathname}
            openSections={getOpenSections(s.id)}
            onSectionOpenChange={(section, open) =>
              handleSectionOpenChange(s.id, section, open)
            }
            dropState={dropState}
            onDropFiles={handleDropFiles}
            onDropHover={handleDropHover}
          />
        ))}
        {mine.length === 0 && (
          <div className="px-3 py-1.5 text-[12px] italic text-muted">
            No workspaces yet.
          </div>
        )}
      </nav>

      <div className="mt-6 border-t border-border px-2 py-2">
        <NavRow href="/docs" icon={<HelpIcon />} label="Docs" active={pathname.startsWith("/docs")} />
        <NavRow href="/settings" icon={<SettingsIcon />} label="Settings" active={pathname.startsWith("/settings")} />
      </div>
    </aside>
  );
}
