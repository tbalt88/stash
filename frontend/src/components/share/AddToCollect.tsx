"use client";

import type { CollectableObjectType } from "../../lib/api";
import { useCollectTray } from "../../lib/collectTray";

interface Props {
  objectType: CollectableObjectType;
  objectId: string;
  workspaceId: string;
  label: string;
}

/**
 * Small "+" button that adds the given object to the Collect tray. Renders
 * "✓ in tray" when the item is already collected so the user can see status
 * at a glance and remove it without opening the tray.
 */
export default function AddToCollect({ objectType, objectId, workspaceId, label }: Props) {
  const { add, remove, has } = useCollectTray();
  const inTray = has(objectType, objectId);

  return (
    <button
      onClick={() =>
        inTray
          ? remove(objectType, objectId)
          : add({ object_type: objectType, object_id: objectId, workspace_id: workspaceId, label })
      }
      title={inTray ? "Remove from Collect tray" : "Add to Collect tray"}
      className={
        "rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition " +
        (inTray
          ? "border-brand/40 bg-brand/15 text-brand hover:border-brand/60"
          : "border-border bg-raised text-foreground hover:border-foreground")
      }
    >
      {inTray ? "✓ In tray" : "+ Collect"}
    </button>
  );
}
