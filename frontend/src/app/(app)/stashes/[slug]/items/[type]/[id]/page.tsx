import type { Metadata } from "next";

import { SSR_BACKEND_ORIGIN as BACKEND_ORIGIN } from "@/lib/backendOrigin";

import StashItemClient from "./StashItemClient";

async function loadStash(slug: string) {
  const res = await fetch(`${BACKEND_ORIGIN}/api/v1/stashes/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; type: string; id: string }>;
}): Promise<Metadata> {
  const { slug, type, id } = await params;
  const data = await loadStash(slug);
  if (!data) return { title: "Stash · Stash" };
  const item = (data.items as { object_type: string; object_id: string; label: string }[]).find(
    (it) => it.object_type === type && it.object_id === id
  );
  const itemLabel = item?.label ?? "Item";
  return {
    title: `${itemLabel} · ${data.stash.title} · Stash`,
    alternates: {
      canonical: `/stashes/${slug}/items/${type}/${id}`,
      types: {
        "text/markdown": `/stashes/${slug}/items/${type}/${id}.md`,
        "application/json": `/stashes/${slug}/items/${type}/${id}.json`,
      },
    },
  };
}

export default async function StashItemPage({
  params,
}: {
  params: Promise<{ slug: string; type: string; id: string }>;
}) {
  const { slug, type, id } = await params;
  return <StashItemClient slug={slug} type={type} itemId={id} />;
}
