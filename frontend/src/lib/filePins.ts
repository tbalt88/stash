"use client";

import { usePins } from "./pins";

// Pinned files/folders for the Files page quick-access strip. Pins are a flat
// set of object ids per workspace; the kind + route are resolved from the
// loaded items at render time, so folders, pages, tables, and files can all be
// pinned without separate buckets.
const FILE_PINS_KEY = "stash_files_pins";

export function useFilePins(workspaceId: string) {
  return usePins(FILE_PINS_KEY, workspaceId);
}
