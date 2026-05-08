"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppShell from "../../../../../components/AppShell";
import { useBreadcrumbs } from "../../../../../components/BreadcrumbContext";
import { useAuth } from "../../../../../hooks/useAuth";
import { getFile } from "../../../../../lib/api";
import type { FileInfo } from "../../../../../lib/types";

function isCsv(ct: string) {
  return ct?.includes("csv") || ct?.startsWith("text/csv");
}
function isHtml(ct: string) {
  return ct?.includes("html");
}
function isPdf(ct: string) {
  return ct?.includes("pdf");
}
function isImage(ct: string) {
  return ct?.startsWith("image/");
}
function isMarkdown(ct: string, name: string) {
  return ct?.includes("markdown") || name.toLowerCase().endsWith(".md");
}
function isText(ct: string) {
  return ct?.startsWith("text/");
}

export default function FileViewerPage() {
  const params = useParams();
  const router = useRouter();
  const stashId = params.stashId as string;
  const fileId = params.fileId as string;
  const { user, loading, logout } = useAuth();

  const [file, setFile] = useState<FileInfo | null>(null);
  const [textBody, setTextBody] = useState<string | null>(null);
  const [error, setError] = useState("");

  useBreadcrumbs(
    file ? [{ label: file.name }] : [{ label: "File" }],
    `${stashId}/file/${fileId}/${file?.name ?? ""}`
  );

  const load = useCallback(async () => {
    try {
      const f = await getFile(stashId, fileId);
      setFile(f);
      if (f.url && (isText(f.content_type) || isMarkdown(f.content_type, f.name) || isCsv(f.content_type))) {
        const res = await fetch(f.url);
        if (res.ok) setTextBody(await res.text());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    }
  }, [stashId, fileId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading)
    return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
  if (!user) return null;

  return (
    <AppShell user={user} onLogout={logout}>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* File toolbar */}
        <div className="flex items-center justify-between border-b border-border px-5 py-2.5 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-foreground">{file?.name}</span>
            {file && (
              <span className="text-muted">
                {file.content_type} · {formatBytes(file.size_bytes)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {file?.url && (
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                download={file.name}
                className="rounded-md p-1.5 text-muted hover:bg-raised"
                title="Download"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {error && (
          <div className="border-b border-red-300/40 bg-red-500/10 px-5 py-2 text-[13px] text-red-500">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto bg-base scroll-thin">
          {file && <FileBody file={file} text={textBody} />}
        </div>
      </div>
    </AppShell>
  );
}

function FileBody({ file, text }: { file: FileInfo; text: string | null }) {
  if (!file.url) {
    return <p className="px-5 py-8 text-muted">No download URL.</p>;
  }
  if (isPdf(file.content_type)) {
    return <iframe src={file.url} className="h-full w-full bg-gray-200" title={file.name} />;
  }
  if (isImage(file.content_type)) {
    return (
      <div className="flex items-center justify-center bg-gray-100 p-8">
        <img src={file.url} alt={file.name} className="max-h-full max-w-full" />
      </div>
    );
  }
  if (isHtml(file.content_type)) {
    return (
      <iframe
        src={file.url}
        className="h-full w-full bg-white"
        sandbox="allow-scripts allow-same-origin"
        title={file.name}
      />
    );
  }
  if (isCsv(file.content_type)) {
    return <CsvTable text={text} />;
  }
  if (isMarkdown(file.content_type, file.name)) {
    return (
      <article className="markdown-content mx-auto max-w-3xl px-12 py-8 text-[15px] leading-relaxed text-foreground">
        <Markdown remarkPlugins={[remarkGfm]}>{text || ""}</Markdown>
      </article>
    );
  }
  if (isText(file.content_type)) {
    return (
      <pre className="scroll-thin h-full overflow-auto px-5 py-4 font-mono text-[12.5px] text-foreground">
        {text || "Loading…"}
      </pre>
    );
  }
  return (
    <div className="mx-auto max-w-md px-8 py-12 text-center text-[13px] text-muted">
      <p className="mb-3">No inline preview for this file type.</p>
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-[var(--color-brand-600)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--color-brand-700)]"
      >
        Open original ↗
      </a>
    </div>
  );
}

function CsvTable({ text }: { text: string | null }) {
  const rows = useMemo(() => parseCsv(text || ""), [text]);
  if (!text) return <p className="px-5 py-8 text-muted">Loading…</p>;
  if (rows.length === 0) return <p className="px-5 py-8 text-muted">Empty CSV.</p>;

  const [header, ...body] = rows;
  return (
    <div className="px-5 py-5">
      <div className="overflow-hidden rounded-xl border border-border bg-base">
        <table className="w-full text-[12.5px]">
          <thead className="bg-surface">
            <tr>
              {header.map((h, i) => (
                <th
                  key={i}
                  className="border-b border-border px-4 py-2 text-left font-medium text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-b-0 hover:bg-surface/60">
                {row.map((c, ci) => (
                  <td
                    key={ci}
                    className={
                      "px-4 py-2 " +
                      (looksNumeric(c) ? "text-right font-mono text-foreground" : "text-foreground")
                    }
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseCsv(text: string): string[][] {
  // Minimal CSV parser — handles quoted fields with commas + escaped quotes.
  // Good enough for the demo; swap for papaparse if files get gnarlier.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"' && cell === "") inQuote = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (c === "\r") {
        // ignore
      } else {
        cell += c;
      }
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x !== ""));
}

function looksNumeric(s: string): boolean {
  if (!s) return false;
  return /^-?\$?[\d,]+(\.\d+)?%?$/.test(s.trim());
}

function formatBytes(b: number): string {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
