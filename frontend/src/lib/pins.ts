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

export function usePins(storageKey: string, workspaceId: string) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readPinMap(storageKey)[workspaceId] ?? []);
  }, [storageKey, workspaceId]);

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id];
        const map = readPinMap(storageKey);
        map[workspaceId] = next;
        writePinMap(storageKey, map);
        return next;
      });
    },
    [storageKey, workspaceId],
  );

  const pinnedSet = useMemo(() => new Set(ids), [ids]);
  const isPinned = (id: string) => pinnedSet.has(id);

  return { pinnedIds: ids, pinnedSet, isPinned, toggle };
}
