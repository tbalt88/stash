/** Wiki-link autocomplete helpers.
 *
 * Links are stored in content_markdown as ordinary markdown links with
 * stable id URLs — `[name](/workspaces/<ws>/p/<uuid>)`. This module
 * handles the authoring-side UX: ranking and labeling suggestions when
 * the user types `[[`. Suggestion paths use the folder chain so a link
 * to a sibling page reads as `Page` and a link across folders reads as
 * `folder/sub/Page`.
 */

import type { WorkspacePageEntry } from "./api";

export interface WikiLinkContext {
  /** folder_id of the page doing the linking, null for root-level. */
  folderId: string | null;
  /** Folder names from workspace root down to folderId, for sibling detection. */
  folderPath: string[];
}

function pathsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function formatPagePath(
  page: WorkspacePageEntry,
  ctx: WikiLinkContext
): string {
  if (pathsEqual(page.folder_path, ctx.folderPath)) return page.name;
  if (page.folder_path.length === 0) return page.name;
  return `${page.folder_path.join("/")}/${page.name}`;
}

export function rankForAutocomplete(
  pages: WorkspacePageEntry[],
  ctx: WikiLinkContext
): WorkspacePageEntry[] {
  const score = (p: WorkspacePageEntry) => {
    if (pathsEqual(p.folder_path, ctx.folderPath)) return 0;
    // Pages whose folder is a prefix or extension of the current folder
    // are likely to be referenced more often than fully unrelated pages.
    const minLen = Math.min(p.folder_path.length, ctx.folderPath.length);
    let shared = 0;
    for (let i = 0; i < minLen; i++) {
      if (p.folder_path[i] === ctx.folderPath[i]) shared++;
      else break;
    }
    return shared > 0 ? 1 : 2;
  };
  return [...pages].sort((a, b) => {
    const s = score(a) - score(b);
    if (s !== 0) return s;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function pageHref(page: WorkspacePageEntry, workspaceId: string): string {
  return `/workspaces/${workspaceId}/p/${page.id}`;
}
