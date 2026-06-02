"use client";

import { useCallback, useEffect, useState } from "react";

import { listMyWorkspaces } from "@/lib/api";
import { IntegrationStatus, listIntegrations } from "@/lib/integrations";

import IntegrationCard from "./IntegrationCard";
import ObsidianVaultDropZone from "./ObsidianVaultDropZone";

type Props = {
  /** When true, render without the outer section chrome — for embedding
   *  inline in the main /settings page alongside other sections. */
  embedded?: boolean;
};

/**
 * Generic Integrations panel. Iterates every provider returned by
 * `/api/v1/integrations` — adding a new provider on the backend
 * automatically shows up here.
 */
export default function IntegrationsSettings({ embedded = false }: Props) {
  const [providers, setProviders] = useState<IntegrationStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await listIntegrations();
      setProviders(r.providers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-fetch when the user comes back from an OAuth callback (the
  // callback redirects to /settings/integrations?connected=<provider>).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      void refresh();
      // Strip the query param so a manual refresh doesn't keep firing.
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [refresh]);

  const body = (
    <>
      <div>
        <h2 className="text-base font-semibold text-foreground">Integrations</h2>
        <p className="text-xs text-muted mt-0.5">
          Connect third-party accounts so Stash can import content and
          export your decks. Disconnect revokes the token on the provider
          too.
        </p>
      </div>

      {error && (
        <div className="text-xs text-error rounded-lg border border-error/30 bg-error/10 px-3 py-2">
          {error}
        </div>
      )}

      {providers === null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="text-xs text-muted">No integrations registered.</div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <IntegrationCard key={p.provider} status={p} onChanged={refresh} />
          ))}
        </div>
      )}

      <ObsidianVaultCard />
    </>
  );

  if (embedded) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        {body}
      </section>
    );
  }
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 py-10">
        <div className="w-full max-w-2xl mx-auto space-y-4">{body}</div>
      </main>
    </div>
  );
}

// Obsidian isn't an OAuth connector — there's nothing to sync. It's a one-shot
// vault upload: markdown becomes pages in Files, other files land in Files,
// folders preserved. That's the whole integration.
function ObsidianVaultCard() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  useEffect(() => {
    listMyWorkspaces()
      .then(({ workspaces }) => {
        if (workspaces.length > 0) setWorkspaceId(workspaces[0].id);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-3">
      <div>
        <h3 className="text-[14px] font-medium text-foreground">Obsidian vault</h3>
        <p className="text-xs text-muted mt-0.5">
          Upload a vault — markdown becomes pages in Files, folders are
          preserved, and <code>.obsidian/</code> is skipped. There&rsquo;s
          nothing to keep in sync; re-upload anytime.
        </p>
      </div>
      {workspaceId ? (
        <ObsidianVaultDropZone
          workspaceId={workspaceId}
          onUploaded={(n) => setUploadedCount((c) => c + n)}
        />
      ) : (
        <div className="text-xs text-muted">Loading…</div>
      )}
      {uploadedCount > 0 && (
        <p className="text-[11.5px] text-brand">
          Added {uploadedCount} file{uploadedCount === 1 ? "" : "s"} to Files.
        </p>
      )}
    </div>
  );
}
