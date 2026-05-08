"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Workspace } from "../lib/types";
import { listMyWorkspaces } from "../lib/api";
import AppSidebar from "./AppSidebar";
import AskRail from "./AskRail";
import ShareModal from "./ShareModal";
import { useBreadcrumbsValue } from "./BreadcrumbContext";

interface AppShellProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

const SIDEBAR_KEY = "stash_sidebar_collapsed";
const RAIL_KEY = "stash_rail_collapsed";

function readBool(key: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key) === "1";
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      {collapsed && <path d="M14 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function RailToggleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
    </svg>
  );
}

export default function AppShell({ user, onLogout, children }: AppShellProps) {
  const pathname = usePathname();
  const breadcrumbs = useBreadcrumbsValue();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [activeStashId, setActiveStashId] = useState<string | null>(null);
  const [stashes, setStashes] = useState<Workspace[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(readBool(SIDEBAR_KEY));
    setRailCollapsed(readBool(RAIL_KEY));
    listMyWorkspaces()
      .then((r) => setStashes(r.workspaces ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const m =
      pathname.match(/^\/stashes\/([^/]+)/) ||
      pathname.match(/^\/workspaces\/([^/]+)/);
    if (m?.[1]) setActiveStashId(m[1]);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setRailCollapsed((c) => {
          const next = !c;
          if (typeof window !== "undefined") localStorage.setItem(RAIL_KEY, next ? "1" : "0");
          return next;
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarCollapsed((c) => {
          const next = !c;
          if (typeof window !== "undefined") localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeStash = stashes.find((s) => s.id === activeStashId);
  const initial = (user.display_name || user.name || "?")[0].toUpperCase();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base">
      {/* Sticky top header — spans all three columns */}
      <header className="sticky top-0 z-30 flex h-11 flex-shrink-0 items-center justify-between border-b border-border bg-base/85 px-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <button
            onClick={() => {
              setSidebarCollapsed((c) => {
                const next = !c;
                if (typeof window !== "undefined")
                  localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
                return next;
              });
            }}
            className="rounded p-1 text-muted hover:bg-raised"
            title="Toggle sidebar (⌘\\)"
          >
            <SidebarToggleIcon collapsed={sidebarCollapsed} />
          </button>
          <Breadcrumb
            activeStash={activeStash}
            pageCrumbs={breadcrumbs}
          />
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-[var(--color-brand-700)]"
            title={user.display_name || user.name}
          >
            {initial}
          </Link>
          {activeStashId && (
            <button
              className="ml-1 rounded-md bg-[var(--color-brand-600)] px-2.5 py-1 text-[12.5px] font-medium text-white hover:bg-[var(--color-brand-700)]"
              onClick={() => setShareOpen(true)}
            >
              Share
            </button>
          )}
          <button
            onClick={() => {
              setRailCollapsed((c) => {
                const next = !c;
                if (typeof window !== "undefined") localStorage.setItem(RAIL_KEY, next ? "1" : "0");
                return next;
              });
            }}
            className="ml-0.5 rounded p-1 text-muted hover:bg-raised"
            title="Toggle agent sidebar (⌘.)"
          >
            <RailToggleIcon />
          </button>
          <button onClick={onLogout} className="rounded p-1 text-muted hover:bg-raised" title="Sign out">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      <div
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${sidebarCollapsed ? "0px" : "260px"} minmax(0, 1fr) ${railCollapsed ? "44px" : "360px"}`,
        }}
      >
        <AppSidebar
          user={user}
          onLogout={onLogout}
          collapsed={sidebarCollapsed}
        />
        <main className="flex min-w-0 flex-col overflow-y-auto bg-base">{children}</main>
        <AskRail
          stashId={activeStashId}
          collapsed={railCollapsed}
          onToggleCollapsed={() => {
            setRailCollapsed((c) => {
              const next = !c;
              if (typeof window !== "undefined") localStorage.setItem(RAIL_KEY, next ? "1" : "0");
              return next;
            });
          }}
        />
      </div>
      {activeStashId && (
        <ShareModal
          open={shareOpen}
          stashId={activeStashId}
          stashName={activeStash?.name || "Stash"}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

function Breadcrumb({
  activeStash,
  pageCrumbs,
}: {
  activeStash: Workspace | undefined;
  pageCrumbs: { label: string; href?: string; onClick?: () => void }[] | null;
}) {
  const items: { label: string; href?: string }[] = [];
  if (activeStash) {
    items.push({ label: activeStash.name, href: `/stashes/${activeStash.id}` });
  } else {
    items.push({ label: "Stashes", href: "/" });
  }
  if (pageCrumbs && pageCrumbs.length > 0) {
    pageCrumbs.forEach((c) => items.push({ label: c.label, href: c.href }));
  }

  return (
    <span className="ml-1.5 flex min-w-0 items-center gap-1.5 text-muted">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        const isStash = i === 0;
        return (
          <span key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <span className="text-muted/60">/</span>}
            {isStash && <span className="text-[14px]">📊</span>}
            {!last && c.href ? (
              <Link href={c.href} className="truncate hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            )}
          </span>
        );
      })}
      <span className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M2 12h3M19 12h3M12 2v3M12 19v3" />
        </svg>
        Edited just now
      </span>
    </span>
  );
}
