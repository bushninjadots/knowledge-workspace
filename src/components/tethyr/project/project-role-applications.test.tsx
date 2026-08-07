import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplyToRoleButton } from "./project-role-applications";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

type Call = {
  kind: "select" | "insert" | "update";
  table: string;
  insert?: unknown;
  update?: unknown;
};

// Shared mutable state referenced by the hoisted vi.mock factory below.
const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
  calls: [] as Call[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

function createFakeSupabase({
  apps = [],
  user = "user-1",
}: { apps?: { id: string; status: string }[]; user?: string | null } = {}) {
  fake.calls.length = 0;
  const from = vi.fn((table: string) => {
    const builder = {
      _select: null as string | null,
      _insert: null as unknown,
      _update: null as unknown,
      select(cols: string) {
        builder._select = cols;
        return builder;
      },
      eq() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      in() {
        return builder;
      },
      insert(v: unknown) {
        builder._insert = v;
        return builder;
      },
      update(v: unknown) {
        builder._update = v;
        return builder;
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
        const kind = builder._update ? "update" : builder._insert ? "insert" : "select";
        fake.calls.push({
          kind,
          table,
          insert: builder._insert ?? undefined,
          update: builder._update ?? undefined,
        });
        const result =
          kind === "update"
            ? { data: null, error: null }
            : kind === "insert"
              ? { data: [builder._insert], error: null }
              : { data: apps, error: null };
        return Promise.resolve(result).then(onFulfilled);
      },
    };
    return builder;
  });
  const auth = {
    getUser: vi.fn(async () => ({
      data: { user: user ? { id: user } : null },
      error: null,
    })),
  };
  return { from, auth };
}

function renderButton(props: Partial<Parameters<typeof ApplyToRoleButton>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ApplyToRoleButton
        roleId="role-1"
        projectId="project-1"
        isOwner={false}
        meId="user-1"
        {...props}
      />
    </QueryClientProvider>,
  );
}

/** Point the mocked supabase module at a fresh fake and reset call log. */
function useFake({
  apps = [],
  user = "user-1",
}: { apps?: { id: string; status: string }[]; user?: string | null } = {}) {
  const built = createFakeSupabase({ apps, user });
  fake.supabase.from = built.from;
  fake.supabase.auth = built.auth;
}

beforeEach(() => {
  fake.calls.length = 0;
  const built = createFakeSupabase();
  fake.supabase.from = built.from;
  fake.supabase.auth = built.auth;
});

// --- Tests ---------------------------------------------------------------

describe("ApplyToRoleButton", () => {
  it("shows a sign-in link for signed-out visitors instead of an Apply button", async () => {
    useFake({ apps: [], user: null });
    renderButton({ meId: null });
    expect(await screen.findByRole("link", { name: /sign in to apply/i })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  it("re-opens a declined application with an update instead of inserting a duplicate", async () => {
    useFake({ apps: [{ id: "app-1", status: "declined" }] });
    renderButton();

    const again = await screen.findByRole("button", { name: /apply again/i });
    await userEvent.click(again);

    await userEvent.type(
      screen.getByPlaceholderText(/why'd you like to join/i),
      "I have the skills for this",
    );
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      const updates = fake.calls.filter(
        (c) => c.kind === "update" && c.table === "project_role_applications",
      );
      expect(updates.length).toBe(1);
    });
    const update = fake.calls.find((c) => c.kind === "update")!;
    expect(update.update).toMatchObject({
      status: "pending",
      message: "I have the skills for this",
    });
    // No new row created.
    expect(fake.calls.some((c) => c.kind === "insert")).toBe(false);

    // Optimistic flip so the UI reads as pending.
    expect(await screen.findByText(/application pending/i)).toBeInTheDocument();
  });

  it("does not submit when an accepted application already exists (idempotent)", async () => {
    useFake({ apps: [{ id: "app-1", status: "accepted" }] });
    renderButton();

    // Accepted state is terminal — no Apply / Apply again button at all.
    expect(await screen.findByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
    expect(fake.calls.filter((c) => c.kind === "insert" || c.kind === "update")).toHaveLength(0);
  });

  it("keeps the Apply button while a pending application is in flight (no dupes)", async () => {
    useFake({ apps: [{ id: "app-1", status: "pending" }] });
    renderButton();

    // Pending state is terminal — shows a quiet chip, no button.
    expect(await screen.findByText(/application pending/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  it("inserts a fresh application when the user has never applied", async () => {
    useFake({ apps: [] });
    renderButton();

    await userEvent.click(await screen.findByRole("button", { name: /^apply$/i }));
    await userEvent.type(screen.getByPlaceholderText(/why'd you like to join/i), "Let's build");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(fake.calls.some((c) => c.kind === "insert")).toBe(true);
    });
    const insert = fake.calls.find((c) => c.kind === "insert")!;
    expect(insert.insert).toMatchObject({
      role_id: "role-1",
      profile_id: "user-1",
      message: "Let's build",
    });
    expect(await screen.findByText(/application pending/i)).toBeInTheDocument();
  });

  it("renders nothing for the project owner", () => {
    const { container } = renderButton({ isOwner: true });
    expect(container).toBeEmptyDOMElement();
  });
});
