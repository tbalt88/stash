"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { ChevronRight, Loader2, MessagesSquare, GraduationCap, Plus, FolderTree, Brain, Plug, ArrowDownAZ, Clock } from "lucide-react";
import { getMemoryFolder, listMySessions, listSkills, listSources, createFolder, createPage, type SessionSummary, type Source } from "@/lib/api";
import { SKILL_MD, skillMdTemplate } from "@/lib/localSkill";
import { cn } from "@/lib/utils";
import { useWorkspace, type TabKind } from "@/lib/workspace-store";
import { urlForTab } from "@/lib/workspace-routes";
import { CONNECTORS, connectorIcon, providerForSourceType } from "@/components/integrations/connectors";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import FilesExplorer, { type Item } from "./files-explorer";

export type ExplorerSection = "files" | "sessions" | "skills" | "agents" | "memory" | "tools";

const SECTIONS: { key: ExplorerSection; label: string; route: string; icon: React.ReactNode }[] = [
  { key: "files", label: "Files", route: "/files", icon: <FolderTree className="h-4 w-4 text-chart-4" /> },
  { key: "skills", label: "Skills", route: "/skills", icon: <GraduationCap className="h-4 w-4 text-chart-4" /> },
  { key: "sessions", label: "Sessions", route: "/sessions", icon: <MessagesSquare className="h-4 w-4 text-chart-4" /> },
  { key: "memory", label: "Memory", route: "/memory", icon: <Brain className="h-4 w-4 text-chart-4" /> },
  { key: "tools", label: "Tools", route: "/tools", icon: <Plug className="h-4 w-4 text-chart-4" /> },
];
const LABEL: Record<ExplorerSection, string> = { files: "Files", skills: "Skills", sessions: "Sessions", memory: "Memory", tools: "Tools", agents: "Agents" };

type Sort = "name" | "recent";

function SortDropdown({ sort, setSort }: { sort: Sort; setSort: (s: Sort) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button title="Sort" aria-label="Sort" className="flex h-7 w-7 items-center justify-center rounded text-sidebar-foreground hover:bg-sidebar-accent">
          {sort === "recent" ? <Clock className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setSort("name")}><ArrowDownAZ className="h-4 w-4" /> Name {sort === "name" && <span className="ml-auto text-brand-600">✓</span>}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSort("recent")}><Clock className="h-4 w-4" /> Most recent {sort === "recent" && <span className="ml-auto text-brand-600">✓</span>}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Open any item as a workbench tab and sync the URL. */
function useOpenTab() {
  const router = useRouter();
  const openTab = useWorkspace((s) => s.openTab);
  return (kind: TabKind, refId: string, title: string) => {
    openTab(kind, refId, title);
    router.replace(urlForTab({ kind, refId }));
  };
}

// `onOpen` fires on double-click (standardized across the explorer — like a file
// manager). `onClick` (single) is for navigation rows (Home → section).
function LeafRow({ icon, label, onClick, onOpen, trailing }: { icon: React.ReactNode; label: string; onClick?: () => void; onOpen?: () => void; trailing?: React.ReactNode }) {
  return (
    <button onClick={onClick} onDoubleClick={onOpen} className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-sidebar-foreground hover:bg-sidebar-accent" title={label}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

function LoadingRow() {
  return <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>;
}
function EmptyRow({ text }: { text: string }) {
  return <div className="px-3 py-2 text-[12px] text-muted-foreground">{text}</div>;
}

function SessionsSection({ sort }: { sort: Sort }) {
  const open = useOpenTab();
  const [rows, setRows] = useState<SessionSummary[] | null>(null);
  // listMySessions already returns most-recent first, so "recent" is the raw order.
  useEffect(() => { listMySessions(50).then(setRows).catch(() => setRows([])); }, []);
  const label = (s: SessionSummary) => s.title || s.agent_name || "Session";
  const view = rows && (sort === "name" ? [...rows].sort((a, b) => label(a).localeCompare(label(b))) : rows);
  return (
    <div className="py-1">
      {!view && <LoadingRow />}
      {view?.length === 0 && <EmptyRow text="No sessions yet." />}
      {view?.map((s) => <LeafRow key={s.session_id} icon={<MessagesSquare className="h-3.5 w-3.5" />} label={label(s)} onOpen={() => open("session", s.session_id, label(s))} />)}
    </div>
  );
}

// Tools = every integration/connector (Slack, Granola, GitHub, …), connected or
// not. Clicking opens the integrations manager to connect/configure.
function ToolsSection() {
  const open = useOpenTab();
  const [connected, setConnected] = useState<Set<string>>(new Set());
  useEffect(() => {
    listSources().then((all) => setConnected(new Set(all.map((s: Source) => providerForSourceType[s.type] ?? s.type)))).catch(() => {});
  }, []);
  return (
    <div className="py-1">
      {CONNECTORS.map((c) => (
        <LeafRow
          key={c.provider}
          icon={connectorIcon(c.provider) ?? <Plug className="h-3.5 w-3.5" />}
          label={c.label}
          trailing={
            <span className={cn("text-[10px]", connected.has(c.provider) ? "text-[var(--color-success)]" : "text-muted-foreground opacity-0 group-hover:opacity-100")}>
              {connected.has(c.provider) ? "Connected" : "Connect"}
            </span>
          }
          onOpen={() => open("tool", "integrations", "Tools")}
        />
      ))}
    </div>
  );
}

function RootSection() {
  const router = useRouter();
  return (
    <div className="py-1">
      {SECTIONS.map((s) => <LeafRow key={s.key} icon={s.icon} label={s.label} onClick={() => router.push(s.route)} trailing={<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />} />)}
    </div>
  );
}

// ── Agents: chat surface (own list, not a folder) ─────────────────────────────
function AgentsExplorer() {
  const open = useOpenTab();
  const [rows, setRows] = useState<SessionSummary[] | null>(null);
  useEffect(() => { listMySessions(50).then(setRows).catch(() => setRows([])); }, []);
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-9 shrink-0 items-center border-b border-sidebar-border px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agents</div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        <LeafRow icon={<Plus className="h-3.5 w-3.5" />} label="New chat" onClick={() => open("agent", `new-${nanoid(5)}`, "New Chat")} />
        {(rows ?? []).map((s) => <LeafRow key={s.session_id} icon={<MessagesSquare className="h-3.5 w-3.5" />} label={s.title || s.agent_name || "Chat"} onOpen={() => open("agent", s.session_id, s.title || s.agent_name || "Chat")} />)}
      </div>
    </div>
  );
}

/** Memory is its own space — a reserved system folder (backend-enforced: one per
 *  user, hidden from Files, can't be renamed/moved/deleted). */
function useMemoryFolder(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMemoryFolder().then((f) => { if (!cancelled) setId(f.id); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return id;
}

/** The left panel. Agents is a chat list. Every other section is shown fully
 *  (no accordion) with a breadcrumb up to Home, which lists the sections. Files
 *  and Memory are VFS file managers (breadcrumbs, context menu, drag, upload);
 *  Memory is a dedicated reserved folder, hidden from Files. */
export default function Explorer({ section }: { section: ExplorerSection }) {
  const router = useRouter();
  const [atRoot, setAtRoot] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const memoryFolderId = useMemoryFolder();
  // A rail-section change means we're back to viewing that section, not Home.
  useEffect(() => { setAtRoot(false); }, [section]);

  // Skills are VFS folders too — the Skills explorer roots at the list of skills
  // and drills into each skill folder like any other.
  const skillsRoot = useCallback(async (): Promise<Item[]> => {
    const skills = await listSkills();
    return skills.map((s) => ({ kind: "skill" as const, id: s.folder_id, name: s.name }));
  }, []);
  // A skill is a folder + SKILL.md — the Skills root's "create native item" action.
  const createSkill = useCallback(async () => {
    const folder = await createFolder("New skill", null);
    await createPage(SKILL_MD, folder.id, skillMdTemplate("New skill"));
  }, []);

  if (section === "agents") return <AgentsExplorer />;

  // Files, Memory & Skills are VFS file managers (own breadcrumb/toolbar).
  if ((section === "files" || section === "memory" || section === "skills") && !atRoot) {
    if (section === "memory" && !memoryFolderId) {
      return <div className="flex h-full flex-col bg-sidebar"><div className="flex h-9 items-center border-b border-sidebar-border px-3 text-[12px] text-muted-foreground">Home / Memory</div><LoadingRow /></div>;
    }
    return (
      <div className="flex h-full flex-col bg-sidebar">
        <FilesExplorer
          key={section}
          onRoot={() => setAtRoot(true)}
          rootLabel={section === "memory" ? "Memory" : section === "skills" ? "Skills" : "Files"}
          rootFolderId={section === "memory" ? memoryFolderId : null}
          hideFolderId={section === "files" ? memoryFolderId : null}
          loadRoot={section === "skills" ? skillsRoot : undefined}
          newRootItem={section === "skills" ? { label: "New skill", run: createSkill } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Breadcrumb + actions on one row (matches the Files explorer). */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-[var(--divider-color)] px-3 text-[12px]">
        <button onClick={() => setAtRoot(true)} className={cn("truncate hover:text-foreground", atRoot ? "font-medium text-foreground" : "text-muted-foreground")}>
          Home
        </button>
        {!atRoot && (
          <>
            <span className="text-muted-foreground/50">/</span>
            <button onClick={() => router.push(SECTIONS.find((s) => s.key === section)?.route ?? "/files")} className="truncate font-medium text-foreground">
              {LABEL[section]}
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {!atRoot && section === "sessions" && <SortDropdown sort={sort} setSort={setSort} />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {atRoot ? <RootSection /> : section === "sessions" ? <SessionsSection sort={sort} /> : <ToolsSection />}
      </div>
    </div>
  );
}
