import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PROJECT_KEY, useUpdateProjectContent } from "./use-projects";
import type { ProjectDetail } from "./use-projects";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
  calls: [] as {
    kind: "select" | "update";
    table: string;
    update?: unknown;
  }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

function createFakeSupabase({ failUpdate = false }: { failUpdate?: boolean } = {}) {
  fake.calls.length = 0;
  const from = vi.fn((table: string) => {
    const builder = {
      _update: undefined as unknown,
      update(v: unknown) {
        builder._update = v;
        return builder;
      },
      eq() {
        return builder;
      },
      select() {
        return builder;
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
        const kind = builder._update !== undefined ? "update" : "select";
        fake.calls.push({ kind, table, update: builder._update ?? undefined });
        const result =
          kind === "update"
            ? failUpdate
              ? { data: null, error: { message: "boom" } }
              : { data: null, error: null }
            : { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled);
      },
    };
    return builder;
  });
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
  };
  return { from, auth };
}

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

  const built = createFakeSupabase({ failUpdate });
  fake.supabase.from = built.from;
  fake.supabase.auth = built.auth;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const utils = renderHook(() => useUpdateProjectContent(), { wrapper });
  return { qc, ...utils };
}

// --- Tests ---------------------------------------------------------------

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

    const update = fake.calls.find((c) => c.kind === "update");
    expect(update).toBeDefined();
    expect(update!.table).toBe("projects");
    expect(update!.update).toEqual({ gallery: nextGallery });
  });

  it("persists resources via the projects table", async () => {
    const { result } = renderMutation();
    const nextResources = [{ title: "Repo", url: "https://repo", type: "article" as const }];

    await act(async () => {
      await result.current.mutateAsync({ projectId: "project-1", resources: nextResources });
    });

    const update = fake.calls.find((c) => c.kind === "update");
    expect(update!.update).toEqual({ resources: nextResources });
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
    expect(fake.calls.some((c) => c.kind === "update")).toBe(false);
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
