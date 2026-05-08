"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { User } from "../lib/types";
import AppSidebar from "./AppSidebar";
import AskRail from "./AskRail";
import TopBar from "./TopBar";

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

export default function AppShell({ user, onLogout, children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [activeStashId, setActiveStashId] = useState<string | null>(null);

  useEffect(() => {
    setSidebarCollapsed(readBool(SIDEBAR_KEY));
    setRailCollapsed(readBool(RAIL_KEY));
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

  return (
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: `${sidebarCollapsed ? "56px" : "260px"} 1fr ${railCollapsed ? "48px" : "360px"}`,
      }}
    >
      <AppSidebar
        user={user}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => {
          setSidebarCollapsed((c) => {
            const next = !c;
            if (typeof window !== "undefined") localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
            return next;
          });
        }}
      />
      <main className="flex min-w-0 flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
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
  );
}
