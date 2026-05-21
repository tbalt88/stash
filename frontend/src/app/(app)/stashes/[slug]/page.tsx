import type { Metadata } from "next";

import { SSR_BACKEND_ORIGIN as BACKEND_ORIGIN } from "@/lib/backendOrigin";

import StashPageClient from "./StashPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicStash(slug);
  if (!data) return { title: "Stash · Stash" };
  const title = `${data.stash.title} · Stash`;
  const description =
    data.stash.description ||
    `A Stash of ${data.items.length} item${data.items.length === 1 ? "" : "s"} from ${data.workspace_name}.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/stashes/${slug}`,
      types: {
        "text/markdown": `/stashes/${slug}.md`,
        "application/json": `/stashes/${slug}.json`,
      },
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/stashes/${slug}`,
      siteName: "Stash",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function loadPublicStash(slug: string) {
  const res = await fetch(`${BACKEND_ORIGIN}/api/v1/stashes/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function StashPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <div className="sr-only">
        Agent-readable Stash versions are available at {`/stashes/${slug}.md`} and{" "}
        {`/stashes/${slug}.json`}.
      </div>
      <StashPageClient slug={slug} />
    </>
  );
}
