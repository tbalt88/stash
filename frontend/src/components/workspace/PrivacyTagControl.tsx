"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addObjectShare,
  getObjectPermissions,
  getWorkspaceMembers,
  setObjectVisibility,
} from "../../lib/api";
import type { ObjectPermission, WorkspaceMember } from "../../lib/types";

type Visibility = "inherit" | "private" | "link";

interface PrivacyTagControlProps {
  workspaceId: string;
  objectType: "page" | "session";
  objectId: string;
}

export default function PrivacyTagControl({
  workspaceId,
  objectType,
  objectId,
}: PrivacyTagControlProps) {
  const [permissions, setPermissions] = useState<ObjectPermission | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [nextPermissions, nextMembers] = await Promise.all([
      getObjectPermissions(objectType, objectId),
      getWorkspaceMembers(workspaceId),
    ]);
    setPermissions(nextPermissions);
    setMembers(nextMembers);
  }, [objectId, objectType, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(() => {})
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load privacy");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const visibility: Visibility = permissions?.visibility === "private"
    ? "private"
    : permissions?.visibility === "link" || permissions?.visibility === "public"
    ? "link"
    : "inherit";

  const sharedUserIds = useMemo(
    () => new Set((permissions?.shares ?? []).map((share) => share.user_id)),
    [permissions]
  );
  const shareableMembers = members.filter((member) => !sharedUserIds.has(member.user_id));

  async function changeVisibility(next: Visibility) {
    setBusy(true);
    setError("");
    try {
      await setObjectVisibility(objectType, objectId, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update privacy");
    } finally {
      setBusy(false);
    }
  }

  async function addMember() {
    if (!selectedUserId) return;
    setBusy(true);
    setError("");
    try {
      await addObjectShare(objectType, objectId, selectedUserId, "read");
      setSelectedUserId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-border-subtle bg-surface px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex min-w-[220px] flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            Privacy tag
          </span>
          <select
            value={visibility}
            onChange={(event) => changeVisibility(event.target.value as Visibility)}
            disabled={busy}
            className="rounded-md border border-border bg-base px-2 py-1.5 text-[12.5px] text-foreground focus:border-brand focus:outline-none disabled:opacity-50"
          >
            <option value="inherit">Workspace visible</option>
            <option value="private">Private to selected members</option>
            <option value="link">Public link</option>
          </select>
        </label>

        {visibility === "private" ? (
          <div className="flex min-w-0 flex-1 items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Add member
              </span>
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                disabled={busy || shareableMembers.length === 0}
                className="rounded-md border border-border bg-base px-2 py-1.5 text-[12.5px] text-foreground focus:border-brand focus:outline-none disabled:opacity-50"
              >
                <option value="">Select member</option>
                {shareableMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.display_name || member.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addMember}
              disabled={busy || !selectedUserId}
              className="rounded-md border border-border bg-base px-3 py-1.5 text-[12.5px] font-medium text-foreground hover:border-brand disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ) : null}
      </div>

      {visibility === "private" && permissions?.shares.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {permissions.shares.map((share) => (
            <span
              key={share.user_id}
              className="rounded-md border border-border-subtle bg-base px-2 py-0.5 text-[11px] text-muted"
            >
              {share.user_name}
            </span>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-[12px] text-red-500">{error}</p> : null}
    </section>
  );
}
