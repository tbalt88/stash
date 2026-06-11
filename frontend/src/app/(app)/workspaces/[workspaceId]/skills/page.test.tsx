import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceSkillsPage from "./page";
import {
  createFolder,
  createPage,
  listSkillInvites,
  listSkills,
  type Skill,
} from "../../../../../lib/api";
import { skillMdTemplate } from "../../../../../lib/localSkill";

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceId: "ws-1" }),
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../../../lib/api", () => ({
  API_BASE: "",
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  displayVisibility: (access: "private" | "public", shareCount: number) =>
    access === "public" ? "public" : shareCount > 0 ? "shared" : "private",
  createFolder: vi.fn(),
  createPage: vi.fn(),
  deleteFolder: vi.fn(),
  dismissSkillInvite: vi.fn(),
  forkSkill: vi.fn(),
  listSkillInvites: vi.fn(),
  listSkills: vi.fn(),
}));

vi.mock("../../../../../lib/pins", () => ({
  usePins: () => ({
    pinnedIds: [],
    pinnedSet: new Set<string>(),
    toggle: vi.fn(),
  }),
}));

vi.mock("../../../../../lib/skillNavigationCache", () => ({
  refreshWorkspaceSidebar: vi.fn(() => Promise.resolve()),
}));

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    folder_id: "folder-1",
    name: "Launch Plan",
    description: "How we launch",
    when_to_use: "",
    version: "",
    mcp_exposed: false,
    file_count: 3,
    updated_at: "2026-06-01T00:00:00Z",
    published: null,
    ...overrides,
  };
}

describe("WorkspaceSkillsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.push.mockReset();
    vi.mocked(listSkills).mockResolvedValue([
      skill(),
      skill({
        folder_id: "folder-2",
        name: "Research",
        description: "",
        file_count: 1,
        published: {
          id: "skill-2",
          slug: "research",
          access: "public",
          workspace_permission: "read",
          public_permission: "read",
          discoverable: true,
          cover_image_url: null,
          icon_url: null,
          view_count: 4,
          share_count: 0,
        },
      }),
    ]);
    vi.mocked(listSkillInvites).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders skill folders as cards linking to the skill browse route", async () => {
    render(<WorkspaceSkillsPage />);

    // The name appears in quick-access and the card grid; every instance
    // must link to the workspace skill browse route.
    const launchLinks = (await screen.findAllByText("Launch Plan")).map((el) =>
      el.closest("a"),
    );
    expect(launchLinks.length).toBeGreaterThan(0);
    for (const link of launchLinks) {
      expect(link).toHaveAttribute("href", "/workspaces/ws-1/skills/folder-1");
    }
    expect(screen.getByText("How we launch")).toBeInTheDocument();

    // Unpublished skills badge as Private; published ones reflect access.
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    const researchLinks = screen
      .getAllByText("Research")
      .map((el) => el.closest("a"));
    for (const link of researchLinks) {
      expect(link).toHaveAttribute("href", "/workspaces/ws-1/skills/folder-2");
    }
  });

  it("creates a New Skill folder with a SKILL.md and navigates to it", async () => {
    vi.stubGlobal("prompt", vi.fn(() => "My Skill"));
    vi.mocked(createFolder).mockResolvedValue({
      id: "folder-9",
      workspace_id: "ws-1",
      name: "My Skill",
      parent_folder_id: null,
      created_at: "",
      updated_at: "",
    });
    vi.mocked(createPage).mockResolvedValue({ id: "page-9" });

    render(<WorkspaceSkillsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /New Skill/ }));

    await waitFor(() =>
      expect(createFolder).toHaveBeenCalledWith("ws-1", "My Skill"),
    );
    expect(createPage).toHaveBeenCalledWith(
      "ws-1",
      "SKILL.md",
      "folder-9",
      skillMdTemplate("My Skill"),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/workspaces/ws-1/skills/folder-9"),
    );
  });
});
