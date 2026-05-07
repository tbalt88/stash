"use client";

import { useCallback, useEffect, useState } from "react";

import type { CollectableObjectType } from "./api";

export interface CollectedItem {
  object_type: CollectableObjectType;
  object_id: string;
  workspace_id: string;
  label: string;
  added_at: number;
}

const STORAGE_KEY = "stash_collect_tray_v1";
const EVT = "stash:collect-tray-changed";

function readStorage(): CollectedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items: CollectedItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  // Same-tab notification — the storage event only fires across tabs, so we
  // dispatch a custom event for components mounted in the current document.
  window.dispatchEvent(new Event(EVT));
}

export function useCollectTray() {
  const [items, setItems] = useState<CollectedItem[]>([]);

  useEffect(() => {
    setItems(readStorage());
    const sync = () => setItems(readStorage());
    window.addEventListener("storage", sync);
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVT, sync);
    };
  }, []);

  const add = useCallback((item: Omit<CollectedItem, "added_at">) => {
    const current = readStorage();
    const exists = current.some(
      (c) => c.object_type === item.object_type && c.object_id === item.object_id
    );
    if (exists) return;
    // The tray is workspace-scoped — a View can only contain items from one
    // workspace. If the user adds across workspaces, replace the whole tray
    // rather than mixing (which the backend would reject anyway).
    const fromOtherWs = current.length > 0 && current[0].workspace_id !== item.workspace_id;
    const next = fromOtherWs ? [{ ...item, added_at: Date.now() }] : [...current, { ...item, added_at: Date.now() }];
    writeStorage(next);
  }, []);

  const remove = useCallback((object_type: CollectableObjectType, object_id: string) => {
    const next = readStorage().filter(
      (c) => !(c.object_type === object_type && c.object_id === object_id)
    );
    writeStorage(next);
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    const next = readStorage();
    if (from < 0 || to < 0 || from >= next.length || to >= next.length) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    writeStorage(next);
  }, []);

  const clear = useCallback(() => writeStorage([]), []);

  const has = useCallback(
    (object_type: CollectableObjectType, object_id: string) =>
      items.some((c) => c.object_type === object_type && c.object_id === object_id),
    [items]
  );

  return { items, add, remove, reorder, clear, has };
}
