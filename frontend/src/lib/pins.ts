"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Generic per-workspace pin store backed by localStorage. Pins are a flat set
// of object ids; callers resolve the id back to a folder/file/session at
// render time. Files and Sessions each pass their own storage key.
type PinMap = Record<string, string[]>;

function readPinMap(storageKey: string): PinMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    window.localStorage.removeItem(storageKey);
    return {};
  }
}

function writePinMap(storageKey: string, map: PinMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(map));
}

// Same-tab change signal: the `storage` event only fires in other tabs, so we
// broadcast our own event on every toggle. This keeps the sidebar's pinned
// dropdowns in sync with pins toggled from the Files/Sessions/Stashes pages.
const PINS_EVENT = "stash-pins-change";

export function usePins(storageKey: string, workspaceId: string) {
  const [ids, setIds] = useState<string[]>([]);

  const reread = useCallback(() => {
    setIds(readPinMap(storageKey)[workspaceId] ?? []);
  }, [storageKey, workspaceId]);

  useEffect(() => {
    reread();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ storageKey: string }>).detail;
      if (!detail || detail.storageKey === storageKey) reread();
    };
    window.addEventListener(PINS_EVENT, onChange);
    window.addEventListener("storage", reread);
    return () => {
      window.removeEventListener(PINS_EVENT, onChange);
      window.removeEventListener("storage", reread);
    };
  }, [reread, storageKey]);

  const toggle = useCallback(
    (id: string) => {
      const map = readPinMap(storageKey);
      const current = map[workspaceId] ?? [];
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id];
      map[workspaceId] = next;
      writePinMap(storageKey, map);
      setIds(next);
      window.dispatchEvent(new CustomEvent(PINS_EVENT, { detail: { storageKey } }));
    },
    [storageKey, workspaceId],
  );

  const pinnedSet = useMemo(() => new Set(ids), [ids]);
  const isPinned = (id: string) => pinnedSet.has(id);

  return { pinnedIds: ids, pinnedSet, isPinned, toggle };
}
