"use client";

// Legacy global /wiki surface. The wiki now lives inside each stash —
// folders/pages/files at /stashes/[id] and /stashes/[id]/folders/[id].
// This route just redirects to the user's primary stash so old links
// don't break.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listMyWorkspaces } from "../../lib/api";

export default function GlobalWikiRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { workspaces } = await listMyWorkspaces();
        if (cancelled) return;
        const target = workspaces?.[0];
        if (target) {
          router.replace(`/stashes/${target.id}`);
        } else {
          router.replace("/");
        }
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center text-muted">
      Redirecting to your wiki…
    </div>
  );
}
