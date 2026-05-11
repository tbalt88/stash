"use client";

import { useEffect } from "react";

export interface Slide {
  index: number;
  title: string;
  kicker: string;
  body: string;
}

interface DeckStageProps {
  slides: Slide[];
  current: number;
  onChange: (i: number) => void;
  fullscreen?: boolean;
}

export default function DeckStage({ slides, current, onChange, fullscreen }: DeckStageProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        onChange(Math.min(current + 1, slides.length - 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(Math.max(current - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, onChange, slides.length]);

  const slide = slides[current];
  if (!slide) return null;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={
          "relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-brand-deep)] via-[var(--color-brand-hover)] to-[var(--color-brand)] text-white shadow-2xl " +
          (fullscreen ? "h-full" : "")
        }
      >
        <div className="flex h-full flex-col px-10 py-10">
          <div className="text-[12px] uppercase tracking-[0.3em] opacity-70">{slide.kicker}</div>
          <h2 className="mt-3 font-display text-[42px] font-bold leading-tight tracking-tight">
            {slide.title}
          </h2>
          <div className="mt-6 flex-1 overflow-auto whitespace-pre-wrap text-[16px] leading-relaxed opacity-95">
            {slide.body}
          </div>
          <div className="absolute bottom-4 left-10 text-[11px] opacity-70">
            ← → to navigate · {current + 1} / {slides.length}
          </div>
        </div>
      </div>

      {!fullscreen && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => onChange(Math.max(current - 1, 0))}
            disabled={current === 0}
            className="rounded-md border border-border bg-base px-2 py-1 text-[12px] disabled:opacity-30"
          >
            ←
          </button>
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => onChange(i)}
              className={
                "h-12 w-20 flex-shrink-0 rounded-md border-2 px-1.5 text-left text-[10px] " +
                (i === current
                  ? "border-brand bg-brand-muted text-foreground"
                  : "border-border-subtle bg-surface text-muted hover:border-brand")
              }
            >
              <div className="truncate font-medium">{s.title}</div>
              <div className="truncate text-[9px] opacity-60">{s.kicker}</div>
            </button>
          ))}
          <button
            onClick={() => onChange(Math.min(current + 1, slides.length - 1))}
            disabled={current === slides.length - 1}
            className="rounded-md border border-border bg-base px-2 py-1 text-[12px] disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
