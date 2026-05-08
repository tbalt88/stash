"use client";

import { useEffect, useRef, useState } from "react";
import DeckStage, { type Slide } from "./DeckStage";

interface PresentModeProps {
  slides: Slide[];
  onExit: () => void;
}

export default function PresentMode({ slides, onExit }: PresentModeProps) {
  const [current, setCurrent] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimer = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    function onFsChange() {
      if (!document.fullscreenElement) onExit();
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [onExit]);

  useEffect(() => {
    function onMove() {
      setCursorVisible(true);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
      cursorTimer.current = window.setTimeout(() => setCursorVisible(false), 2000);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
    };
  }, [onExit]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[100] bg-black p-8"
      style={{ cursor: cursorVisible ? "auto" : "none" }}
    >
      <DeckStage slides={slides} current={current} onChange={setCurrent} fullscreen />
    </div>
  );
}
