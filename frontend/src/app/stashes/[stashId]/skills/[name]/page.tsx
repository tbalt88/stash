"use client";

// Legacy "skill" surface — redirect to the folder detail page that now
// hosts the same content. A folder with a SKILL.md is just a folder; the
// SKILL.md page sits alongside any other page in it. Old links keep
// working via this redirect.

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getStashSkill } from "../../../../../lib/api";

export default function SkillRedirect() {
  const params = useParams();
  const router = useRouter();
  const stashId = params.stashId as string;
  const name = decodeURIComponent(params.name as string);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const skill = await getStashSkill(stashId, name);
        if (!cancelled && skill?.folder_id) {
          router.replace(`/stashes/${stashId}/folders/${skill.folder_id}`);
          return;
        }
      } catch {
        // fall through
      }
      if (!cancelled) router.replace(`/stashes/${stashId}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [stashId, name, router]);

  return (
    <div className="flex h-screen items-center justify-center text-muted">
      Redirecting…
    </div>
  );
}
