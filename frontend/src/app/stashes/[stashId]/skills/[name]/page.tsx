"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppShell from "../../../../../components/AppShell";
import { useBreadcrumbs } from "../../../../../components/BreadcrumbContext";
import { useAuth } from "../../../../../hooks/useAuth";
import { getStashSkill, getWorkspace, type StashSkillDetail } from "../../../../../lib/api";
import type { Workspace } from "../../../../../lib/types";

function splitFrontmatter(md: string): { yaml: string; body: string } {
  if (!md.startsWith("---")) return { yaml: "", body: md };
  const end = md.indexOf("\n---", 3);
  if (end < 0) return { yaml: "", body: md };
  return { yaml: md.slice(0, end + 4), body: md.slice(end + 4).replace(/^\n+/, "") };
}

export default function SkillPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const stashId = params.stashId as string;
  const name = decodeURIComponent(params.name as string);
  const fileParam = searchParams.get("file");
  const { user, loading, logout } = useAuth();

  const [stash, setStash] = useState<Workspace | null>(null);
  const [skill, setSkill] = useState<StashSkillDetail | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const activeFileName = fileParam || "SKILL.md";
  const activeFile = skill?.files.find((f) => f.name === activeFileName);
  const isSkillMd = activeFileName === "SKILL.md";

  useBreadcrumbs(
    isSkillMd
      ? [{ label: "Skills" }, { label: `/${name}` }]
      : [{ label: "Skills" }, { label: `/${name}` }, { label: activeFileName }],
    `${stashId}/skill/${name}/${activeFileName}`
  );

  const load = useCallback(async () => {
    try {
      setStash(await getWorkspace(stashId));
      setSkill(await getStashSkill(stashId, name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load skill");
    }
  }, [stashId, name]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading)
    return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  if (!user) return null;

  // The SKILL.md body has frontmatter already stripped server-side (skill.body).
  // Supporting files keep their raw content — strip any frontmatter for display.
  let displayBody = "";
  let displayYaml = "";
  if (isSkillMd && skill) {
    displayBody = skill.body;
    // Synthesize a frontmatter view from the parsed fields.
    const fm = [
      ["name", skill.name],
      ["description", skill.description],
      ["when_to_use", skill.when_to_use],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    displayYaml = fm ? `---\n${fm}\n---` : "";
  } else if (activeFile) {
    const split = splitFrontmatter(activeFile.content);
    displayYaml = split.yaml;
    displayBody = split.body;
  }

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-12 py-10">
          <div className="flex items-center gap-3">
            <span className="text-5xl leading-none">⚡</span>
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-muted">
                Skill · folder · {activeFileName}
              </div>
              <h1 className="mt-0.5 font-display text-[30px] font-bold tracking-tight text-foreground">
                /{skill?.name || name}
              </h1>
            </div>
          </div>
          {isSkillMd && skill?.description && (
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{skill.description}</p>
          )}
          {!isSkillMd && (
            <p className="mt-3 text-[12.5px] text-muted">
              Supporting file in <span className="font-medium text-foreground">/{skill?.name || name}</span>{stash ? <> · in <span className="font-medium text-foreground">{stash.name}</span></> : null}
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-2 text-[13px] text-red-500">
              {error}
            </div>
          )}

          {displayYaml && (
            <div className="mt-5 overflow-hidden rounded-md border border-border bg-surface text-[12.5px]">
              <div className="border-b border-border bg-base/60 px-3 py-1 font-mono text-[10.5px] text-muted">
                {activeFileName} · frontmatter
              </div>
              <pre className="whitespace-pre-wrap px-3 py-2 font-mono leading-relaxed text-foreground">
                {displayYaml}
              </pre>
            </div>
          )}

          <article className="markdown-content mt-6 text-[14.5px] leading-relaxed text-foreground">
            {displayBody ? (
              <Markdown remarkPlugins={[remarkGfm]}>{displayBody}</Markdown>
            ) : (
              <p className="text-muted">{skill ? "Empty file." : "Loading…"}</p>
            )}
          </article>

          {isSkillMd && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  if (!skill) return;
                  await navigator.clipboard.writeText(skill.combined);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-md border border-border bg-base px-3 py-1.5 text-[12.5px] font-medium text-foreground hover:bg-raised"
              >
                {copied ? "Copied" : "Copy as markdown"}
              </button>
              <span className="text-[11px] text-muted">
                Drop this file into any agent&apos;s skills directory.
              </span>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
