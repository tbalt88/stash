import type { Metadata } from "next";
import Link from "next/link";

import { INTEGRATIONS, integrationIcon } from "../_components/BrandIcons";
import CtaPair from "../_components/CtaPair";
import SiteHeader from "../_components/SiteHeader";
import Texture from "../_components/Texture";

export const metadata: Metadata = {
  title: "Company Brain · Stash",
  description:
    "All your company's context in one place every agent can read. Stash connects your tools into a permission-aware source of truth, surfaced as a filesystem any agent can navigate — GitHub, Drive, Gmail, Notion, Slack, and more.",
};

export default function CompanyBrainPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border-subtle py-24 md:py-32">
        <Texture className="h-[560px]" fade="top" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[520px]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 18% 8%, rgba(249,115,22,0.10), transparent 60%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <p className="kicker rise-in mb-6">Company.brain</p>
          <h1 className="max-w-[920px] text-balance font-display text-[clamp(40px,5.4vw,72px)] font-bold leading-[1.02] tracking-[-0.035em] text-ink">
            Your company&apos;s context, in one place{" "}
            <span className="text-brand">every agent can read.</span>
          </h1>
          <p className="mt-7 max-w-[620px] text-[18px] leading-[1.55] text-foreground">
            Your agent is a clueless genius — brilliant, but it doesn&apos;t know
            your people, your projects, or what changed yesterday. Stash connects
            your tools and weaves them into a permission-aware context graph —
            one source of truth, surfaced as a filesystem any agent can read.
            Enterprise context in under five minutes.
          </p>
          <div className="mt-9">
            <CtaPair />
          </div>
        </div>
      </section>

      <section className="border-b border-border-subtle bg-surface py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-7">
          <h2 className="font-display text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            Connect once. Your agent reads it all.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((it) => (
              <div
                key={it.provider}
                className="rounded-[12px] border border-border bg-background p-5 transition-colors hover:border-brand"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                    {integrationIcon(it.provider, 24)}
                  </span>
                  <div className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink">
                    {it.name}
                  </div>
                </div>
                <p className="mt-2 text-[14px] leading-[1.55] text-dim">{it.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border-subtle py-20 md:py-28">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-7 md:grid-cols-3 md:gap-12">
          <Point title="Connect">
            OAuth in and permissions are inherited automatically — no tokens to
            paste, no scripts to run. Access stays scoped to exactly what you
            grant.
          </Point>
          <Point title="Synthesize">
            Stash continuously weaves your sources into a context graph of the
            company — the people, projects, and decisions and how they connect,
            kept accurate in real time, not a one-time export.
          </Point>
          <Point title="Serve">
            Ask one question and your agent answers across every source at once —
            structured results or LLM-ready Markdown, with citations back to
            where it came from.
          </Point>
        </div>
      </section>

      <section className="relative overflow-hidden bg-surface py-28 text-center">
        <Texture className="opacity-70" fade="center" />
        <div className="relative z-10 mx-auto max-w-[1200px] px-7">
          <h2 className="text-balance font-display text-[clamp(36px,4.6vw,64px)] font-bold leading-[1.0] tracking-[-0.035em] text-ink">
            Give your agents the why, not just the what.
          </h2>
          <div className="mt-8 flex justify-center">
            <CtaPair align="center" />
          </div>
          <Link
            href="/agent-drive"
            className="mt-6 inline-flex font-mono text-[13px] text-dim transition hover:text-brand"
          >
            See the Agent Drive →
          </Link>
        </div>
      </section>
    </main>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-[19px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-2.5 text-[15px] leading-[1.6] text-dim">{children}</p>
    </div>
  );
}
