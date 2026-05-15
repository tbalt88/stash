"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ActivityFeed from "../../components/ActivityFeed";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../hooks/useAuth";
import {
  getWorkspace,
  listActivity,
  listWorkspaceActivity,
  type ActivityEvent,
} from "../../lib/api";

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted">Loading…</div>}>
      <ActivityPageInner />
    </Suspense>
  );
}

function ActivityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const { user, loading, logout } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const eventsPromise = workspaceId
      ? listWorkspaceActivity(workspaceId, 100)
      : listActivity(100);
    const workspacePromise = workspaceId ? getWorkspace(workspaceId) : null;

    Promise.all([eventsPromise, workspacePromise])
      .then(([nextEvents, workspace]) => {
        if (!cancelled) setEvents(nextEvents);
        if (!cancelled && workspace) setWorkspaceName(workspace.name);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, workspaceId]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  if (!user) return null;

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="mx-auto max-w-3xl px-12 py-10">
        <h1 className="font-display text-[30px] font-bold tracking-tight text-foreground">
          Activity
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {workspaceId
            ? `Recent work in ${workspaceName || "this workspace"}.`
            : "Recent changes across your workspaces."}
        </p>

        {fetching ? (
          <p className="mt-8 text-[13px] text-muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="mt-8 text-[13px] text-muted">
            No activity yet. Push a transcript, edit a page, or upload a file.
          </p>
        ) : (
          <ActivityFeed events={events} showStash={!workspaceId} />
        )}
      </div>
    </AppShell>
  );
}
