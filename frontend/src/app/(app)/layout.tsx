"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

import AppShell from "../../components/AppShell";
import {
  AppShellSkeleton,
  PublicStashSkeleton,
} from "../../components/SkeletonStates";
import { useAuth } from "../../hooks/useAuth";

// Shared chrome for the signed-in app. Hosting AppShell here (rather than
// inside each subtree's layout or page) keeps the sidebar mounted as you move
// between /stashes/[slug] and /workspaces/[workspaceId], so scroll position
// and folder-open state survive the navigation. Public stash routes are
// readable when signed out, so we render their children bare in that case.
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const isPublicStashRoute = pathname.startsWith("/stashes/");

  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (isPublicStashRoute) return;
    router.push("/login");
  }, [user, loading, isPublicStashRoute, router]);

  if (loading) {
    return isPublicStashRoute ? <PublicStashSkeleton /> : <AppShellSkeleton />;
  }

  if (!user) {
    if (isPublicStashRoute) {
      return <main className="min-h-screen bg-background">{children}</main>;
    }
    return null;
  }

  return (
    <AppShell user={user} onLogout={logout}>
      {children}
    </AppShell>
  );
}
