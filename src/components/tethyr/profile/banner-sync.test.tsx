import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackgroundPickerDialog } from "./background-picker-dialog";
import { BannerStrip } from "./banner-strip";
import { renderRoutePage } from "@/test-utils/route-page";
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
  const { queryClient, ...result } = renderRoutePage(ui);
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  return { invalidateSpy, ...result };
}

beforeEach(() => {
  handle.reset();
  fake.supabase.from = handle.client.from;
  handle.on("profiles:update", () => ({ data: null, error: null }));
});

describe("BackgroundPickerDialog — header sync", () => {
  it("invalidates profile-header-block and current-user on save, keeping the header look", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const { invalidateSpy } = renderWithClient(
      <BackgroundPickerDialog
        open
        onOpenChange={() => {}}
        scope="app"
        background={baseBackground as never}
        publicBackground={null}
        userId="u-1"
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save/i }));

    // The caption position lives in the header block's settings now; saving a
    // background must carry it through untouched, not reset it.
    expect(handle.calls).toContainEqual(
      expect.objectContaining({
        table: "profiles",
        action: "update",
        value: {
          background: expect.objectContaining({ bannerCaptionPosition: "left" }),
        },
      }),
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

    // The caption chip and the toolbar affordance share the accessible name;
    // either opens the caption editor.
    const editButtons = screen.getAllByRole("button", { name: /edit banner caption/i });
    await user.click(editButtons[0]!);
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
