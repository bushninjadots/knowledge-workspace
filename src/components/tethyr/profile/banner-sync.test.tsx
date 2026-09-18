import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BackgroundPickerDialog } from "./background-picker-dialog";
import { BannerStrip } from "./banner-strip";
import { createFakeSupabase } from "../../../../tests/helpers/fake-supabase";

/**
 * Regression tests for the dashboard ↔ studio banner sync (issue tracker #7):
 * caption text and caption position are written from the dashboard surface,
 * but the studio's header block keeps its own `profile-header-block` query.
 * Every write must invalidate that key alongside `current-user`, or the two
 * surfaces drift apart.
 */

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fake = vi.hoisted(() => ({
  supabase: {} as { from: ReturnType<typeof vi.fn> },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

vi.mock("@/lib/dominant-color", () => ({
  useDominantColor: () => null,
}));

vi.mock("@/components/tethyr/drag-drop-file-input", () => ({
  DragDropFileInput: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const handle = createFakeSupabase();

const baseBackground = {
  bannerCaptionPosition: "left" as const,
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  return { invalidateSpy };
}

beforeEach(() => {
  handle.reset();
  fake.supabase.from = handle.client.from;
  handle.on("profiles:update", () => ({ data: null, error: null }));
});

describe("BackgroundPickerDialog — caption position propagation", () => {
  it("invalidates profile-header-block and current-user on save", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const { invalidateSpy } = renderWithClient(
      <BackgroundPickerDialog
        open
        onOpenChange={() => {}}
        background={baseBackground as never}
        publicBackground={null}
        userId="u-1"
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(handle.calls).toContainEqual(
      expect.objectContaining({ table: "profiles", action: "update" }),
    );
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toContain("profile-header-block");
    expect(invalidatedKeys).toContain("current-user");
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("BannerStrip — caption text propagation", () => {
  it("invalidates profile-header-block and current-user when the caption is saved", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { invalidateSpy } = renderWithClient(
      <BannerStrip
        bannerSigned={null}
        bannerCaption="hello"
        userId="u-1"
        onChange={onChange}
        readonly={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /edit caption/i }));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(handle.calls).toContainEqual(
      expect.objectContaining({
        table: "profiles",
        action: "update",
        value: expect.objectContaining({ banner_caption: expect.any(String) }),
      }),
    );
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toContain("profile-header-block");
    expect(invalidatedKeys).toContain("current-user");
    expect(onChange).toHaveBeenCalled();
  });
});
