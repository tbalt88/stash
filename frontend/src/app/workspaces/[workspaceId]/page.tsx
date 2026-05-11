"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WorkspaceLegacyRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.workspaceId as string;
  useEffect(() => {
    router.replace(`/stashes/${id}`);
  }, [id, router]);
  return (
    <div className="flex h-screen items-center justify-center text-muted">
      Redirecting to /stashes/{id}…
    </div>
  );
}
