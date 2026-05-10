"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import DeckStage from "../../../components/share/DeckStage";
import PresentMode from "../../../components/share/PresentMode";
import RecipientShell from "../../../components/share/RecipientShell";
import { resolveShare, type ShareProjection } from "../../../lib/api";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [projection, setProjection] = useState<ShareProjection | null>(null);
  const [error, setError] = useState<{ status: number; detail: string } | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [presenting, setPresenting] = useState(false);

  const load = useCallback(async () => {
    try {
      setProjection(await resolveShare(token));
    } catch (e) {
      const err = e as Error & { status?: number };
      setError({ status: err.status ?? 500, detail: err.message });
    }
  }, [token]);

  useEffect(() => {
    load();
    // Poll every 30s so view_count + content refreshes match real-world activity.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) {
    const isExpired = error.status === 410;
    const isMissing = error.status === 404;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-[28px] font-semibold text-foreground">
          {isExpired ? "This share link has expired" : isMissing ? "Share link not found" : "Couldn't load share"}
        </h1>
        <p className="text-[13px] text-muted">{error.detail}</p>
      </div>
    );
  }

  if (!projection) {
    return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  }

  const isDeck = !!projection.deck && projection.deck.length > 0;

  return (
    <>
      <RecipientShell
        projection={projection}
        token={token}
        onPresent={isDeck ? () => setPresenting(true) : undefined}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-[11px] uppercase tracking-[0.2em] text-brand">
            {isDeck ? "Deck" : "Stash"}
          </div>
          <h1 className="font-display text-[34px] font-bold tracking-tight text-foreground">
            {projection.stash.name}
          </h1>
          {projection.stash.summary && (
            <p className="mt-2 text-[14px] text-dim">{projection.stash.summary}</p>
          )}

          {isDeck && projection.deck && (
            <div className="mt-6">
              <DeckStage
                slides={projection.deck}
                current={slideIdx}
                onChange={setSlideIdx}
              />
            </div>
          )}

          {!isDeck && projection.narrative && (
            <article className="markdown-content mt-6 rounded-2xl border border-border bg-surface px-6 py-6">
              <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-foreground">
                {projection.narrative.body}
              </pre>
            </article>
          )}

          {projection.pages.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-[16px] font-semibold text-foreground">Pages</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {projection.pages.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-border-subtle bg-surface px-4 py-3 text-[13px]"
                  >
                    <div className="font-medium text-foreground">{p.name}</div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] text-dim">
                      {p.body.slice(0, 600)}
                      {p.body.length > 600 ? "…" : ""}
                    </pre>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {projection.files.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-[16px] font-semibold text-foreground">Files</h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
                {projection.files.map((f) => (
                  <li key={f.id} className="text-foreground">
                    📄 {f.name}{" "}
                    <span className="text-muted">
                      ({(f.size_bytes / 1024).toFixed(1)} KB)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </RecipientShell>

      {presenting && projection.deck && (
        <PresentMode
          slides={projection.deck}
          onExit={() => setPresenting(false)}
        />
      )}
    </>
  );
}
