import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StashShareModal from "./StashShareModal";
import { ShareModalProvider, useShareModal } from "../../lib/shareModalContext";
import {
  createStash,
  getWorkspaceSidebar,
  listStashes,
} from "../../lib/api";

vi.mock("../../lib/api", () => ({
  createStash: vi.fn(),
  deleteStash: vi.fn(),
  getWorkspaceSidebar: vi.fn(),
  listStashes: vi.fn(),
  publishStash: vi.fn(),
  removeExternalStash: vi.fn(),
}));

function OpenSessionShareButton() {
  const shareModal = useShareModal();
  return (
    <button
      onClick={() =>
        shareModal.open({
          workspaceId: "workspace-1",
          workspaceName: "Demo Workspace",
          initial: [
            {
              object_type: "session",
              object_id: "session-route-id",
              label_override: "#session-route-id",
            },
          ],
        })
      }
    >
      Share session
    </button>
  );
}

describe("StashShareModal session sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspaceSidebar).mockResolvedValue({
      sessions: [
        {
          id: "session-row-uuid",
          session_id: "session-route-id",
          title: "Debug auth flow",
          agent_name: "Henry's Codex",
          size_bytes: 1024,
          last_at: "2026-05-14T12:00:00Z",
          updated_at: "2026-05-14T12:00:00Z",
        },
      ],
      files: { folders: [], pages: [], files: [] },
      stashes: [],
    });
    vi.mocked(listStashes).mockResolvedValue([]);
    vi.mocked(createStash).mockResolvedValue({
      id: "stash-1",
      workspace_id: "workspace-1",
      slug: "debug-auth-flow",
      title: "Debug auth flow",
      description: "",
      owner_id: "user-1",
      access: "workspace",
      discoverable: false,
      view_count: 0,
      items: [],
      is_external: false,
      added_to_workspace_id: null,
      created_at: "2026-05-14T12:00:00Z",
      updated_at: "2026-05-14T12:00:00Z",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("resolves a route session id to the session row uuid before creating a Stash", async () => {
    render(
      <ShareModalProvider>
        <OpenSessionShareButton />
        <StashShareModal />
      </ShareModalProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Share session" }));

    await screen.findByText("1 item selected");
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Debug auth flow")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: "Create stash" }));

    await waitFor(() =>
      expect(createStash).toHaveBeenCalledWith(
        "workspace-1",
        "Debug auth flow",
        [
          {
            object_type: "session",
            object_id: "session-row-uuid",
            position: 0,
            label_override: "Debug auth flow",
          },
        ],
        { access: "workspace" }
      )
    );
  });
});
