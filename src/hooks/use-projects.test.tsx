import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PROJECT_KEY,
  useUpdateProjectContent,
  useUpdateProjectPresentation,
  useProjectCommunityPostCount,
} from "./use-projects";
import type { ProjectDetail } from "./use-projects";
import { createFakeSupabase, type FakeSupabaseHandle } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

const handle = createFakeSupabase();

function seedProject(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "project-1",
    profile_id: "user-1",
    title: "Test",
    description: null,
    goal: null,
    vision: null,
    status: "active",
    visibility: "public",
    stage: "building",
    started_at: "2026-01-01T00:00:00Z",
    progress_percent: 40,
    cover_url: null,
    gallery: [{ url: "https://img/a.png", caption: "A", type: "image" }],
    resources: [{ title: "Docs", url: "https://docs", type: "article" }],
    links: {},
    tags: [],
    looking_for_feedback: false,
    looking_for_collaborators: false,
    is_featured: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderMutation({ failUpdate = false }: { failUpdate?: boolean } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(PROJECT_KEY("project-1"), {
    project: seedProject(),
    contributors: [],
    skills: [],
    coverSigned: null,
    avatarSigned: {},
  });

  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;

  if (failUpdate) {
    handle.on("projects:update", () => ({ data: null, error: { message: "boom" } }));
  }

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const utils = renderHook(() => useUpdateProjectContent(), { wrapper });
  return { qc, ...utils };
}

// --- Tests ---------------------------------------------------------------

function renderCountQuery(
  projectId = "project-1",
  registerHandler?: (h: FakeSupabaseHandle) => void,
) {
  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  registerHandler?.(handle);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const utils = renderHook(() => useProjectCommunityPostCount(projectId), { wrapper });
  return { qc, ...utils };
}

describe("useProjectCommunityPostCount", () => {
  it("returns the exact count of posts linked to the project", async () => {
    const { result } = renderCountQuery("project-1", (h) =>
      h.on("posts:select", () => ({ data: [], error: null, count: 4 })),
    );

    await waitFor(() => expect(result.current.data).toBe(4));
    const call = handle.calls.find((c) => c.table === "posts" && c.action === "select");
    expect(call?.table).toBe("posts");
    expect(call?.projection).toBe("id");
  });

  it("returns 0 when the posts table is missing", async () => {
    const { result } = renderCountQuery("project-1", (h) =>
      h.on("posts:select", () => ({ data: null, error: { code: "42P01", message: "nope" } })),
    );

    await waitFor(() => expect(result.current.data).toBe(0));
  });
});

describe("useUpdateProjectPresentation", () => {
  it("persists the selected presentation preset", async () => {
    handle.reset();
    fake.supabase.from = handle.client.from;
    fake.supabase.auth = handle.client.auth;

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    qc.setQueryData(PROJECT_KEY("project-1"), {
      project: seedProject(),
      contributors: [],
      skills: [],
      coverSigned: null,
      avatarSigned: {},
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateProjectPresentation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        projectId: "project-1",
        presentationPreset: "collaboration-first",
      });
    });

    const update = handle.calls.find((c) => c.action === "update");
    expect(update?.table).toBe("projects");
    expect(update?.value).toEqual({ presentation_preset: "collaboration-first" });
    const cached = qc.getQueryData<{ project: ProjectDetail }>(PROJECT_KEY("project-1"));
    expect(cached?.project.presentation_preset).toBe("collaboration-first");
  });
});

describe("useUpdateProjectContent", () => {
  it("persists gallery via the projects table", async () => {
    const { result } = renderMutation();
    const nextGallery = [
      { url: "https://img/a.png", caption: "A", type: "image" as const },
      { url: "https://img/b.png", type: "image" as const },
    ];

    await act(async () => {
      await result.current.mutateAsync({ projectId: "project-1", gallery: nextGallery });
    });

    const update = handle.calls.find((c) => c.action === "update");
    expect(update).toBeDefined();
    expect(update!.table).toBe("projects");
    expect(update!.value).toEqual({ gallery: nextGallery });
  });

  it("persists resources via the projects table", async () => {
    const { result } = renderMutation();
    const nextResources = [{ title: "Repo", url: "https://repo", type: "article" as const }];

    await act(async () => {
      await result.current.mutateAsync({ projectId: "project-1", resources: nextResources });
    });

    const update = handle.calls.find((c) => c.action === "update");
    expect(update!.value).toEqual({ resources: nextResources });
  });

  it("optimistically updates the cached project without a refetch", async () => {
    const { result, qc } = renderMutation();
    const nextGallery = [{ url: "https://img/c.png", type: "image" as const }];

    await act(async () => {
      await result.current.mutateAsync({ projectId: "project-1", gallery: nextGallery });
    });

    // The optimistic write lands in the cache; with no observer mounted, an
    // invalidation alone would NOT update the data — so this proves the
    // setQueryData path ran.
    const cached = qc.getQueryData<{ project: ProjectDetail }>(PROJECT_KEY("project-1"));
    expect(cached?.project.gallery).toEqual(nextGallery);
    // Resources untouched by a gallery-only write.
    expect(cached?.project.resources).toEqual([
      { title: "Docs", url: "https://docs", type: "article" },
    ]);
  });

  it("rolls the cache back when the write fails", async () => {
    const { result, qc } = renderMutation({ failUpdate: true });
    const original = qc.getQueryData<{ project: ProjectDetail }>(PROJECT_KEY("project-1"));

    await act(async () => {
      await expect(
        result.current.mutateAsync({ projectId: "project-1", gallery: [] }),
      ).rejects.toThrow();
    });

    const cached = qc.getQueryData<{ project: ProjectDetail }>(PROJECT_KEY("project-1"));
    expect(cached).toEqual(original);
  });

  it("is a no-op when neither gallery nor resources is provided", async () => {
    const { result } = renderMutation();
    await act(async () => {
      await result.current.mutateAsync({ projectId: "project-1" });
    });
    expect(handle.calls.some((c) => c.action === "update")).toBe(false);
  });

  it("invalidates the project-detail query after a successful write", async () => {
    const { result, qc } = renderMutation();

    await act(async () => {
      await result.current.mutateAsync({
        projectId: "project-1",
        gallery: [{ url: "https://img/d.png", type: "image" as const }],
      });
    });

    // With no active observer, invalidation leaves the query marked invalidated
    // so the next mount refetches the server truth.
    const state = qc.getQueryState(PROJECT_KEY("project-1"));
    expect(state?.isInvalidated).toBe(true);
  });
});
