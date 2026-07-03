"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, FolderTree, MessagesSquare, GraduationCap, Brain, Wrench, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import type { User } from "@/lib/types";

type RailItem = { href: string; label: string; icon: typeof Bot; match: (p: string) => boolean };

// Primary sections — each opens its own explorer panel (see workspace-shell).
const PRIMARY: RailItem[] = [
  { href: "/agents", label: "Agents", icon: Bot, match: (p) => p.startsWith("/agents") },
  { href: "/files", label: "Files", icon: FolderTree, match: (p) => p === "/files" || p.startsWith("/f/") || p.startsWith("/p/") || p.startsWith("/folders/") },
  { href: "/sessions", label: "Sessions", icon: MessagesSquare, match: (p) => p.startsWith("/sessions") || p.startsWith("/session-folders") },
  { href: "/skills", label: "Skills", icon: GraduationCap, match: (p) => p.startsWith("/skills") },
  { href: "/memory", label: "Memory", icon: Brain, match: (p) => p.startsWith("/memory") },
  { href: "/tools", label: "Tools", icon: Wrench, match: (p) => p.startsWith("/tools") },
];

function RailButton({ item, active, quiet }: { item: RailItem; active: boolean; quiet?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors",
        active
          ? "bg-brand-500/12 text-brand-600"
          : quiet
            ? "text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="text-[10px] font-medium leading-none">{item.label}</span>
    </Link>
  );
}

/** Bottom-left account control — avatar opens a small menu (settings + sign out).
 *  This is the single home for account actions (removed from the top bar). */
function AccountMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={user.email ?? user.name}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-[12px] font-semibold text-white hover:ring-2 hover:ring-brand-200"
      >
        {user.display_name[0].toUpperCase()}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-0 left-full z-40 ml-2 w-56 overflow-hidden rounded-md border border-border bg-surface py-1 text-[13px] shadow-lg">
          <div className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            Signed in as <span className="break-all text-foreground">{user.email ?? user.name}</span>
          </div>
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-1.5 text-foreground hover:bg-raised">
            Account settings
          </Link>
          <button onClick={() => { setOpen(false); onLogout(); }} className="block w-full px-3 py-1.5 text-left text-foreground hover:bg-raised">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** The icon rail — the workspace's primary nav. Icon + label per section; each
 *  primary section shows its own explorer. Search lives in the top bar; account
 *  actions live on the bottom-left avatar. */
export default function Rail({ user, onLogout }: { user: User; onLogout: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex w-[74px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-rail px-1.5 py-2.5">
      {PRIMARY.map((item, i) => (
        <Fragment key={item.href}>
          <RailButton item={item} active={item.match(pathname)} />
          {/* Agents (chat) is set apart from the VFS sections below. */}
          {i === 0 && <div className="my-1 h-px w-7 bg-[var(--divider-color)]" />}
        </Fragment>
      ))}
      <div className="mt-auto flex w-full flex-col items-center gap-1">
        <RailButton
          item={{ href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") }}
          active={pathname.startsWith("/settings")}
          quiet
        />
        <AccountMenu user={user} onLogout={onLogout} />
      </div>
    </div>
  );
}
