import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCropConfirm } from "./crop-confirm-dialog";
import { avatarShapeStyle } from "@/lib/background-themes";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PNG_FILE = new File(["fake-png-bytes"], "me.png", { type: "image/png" });

function Harness({
  shape,
  onConfirmed,
  avatarBackground,
}: {
  shape: "avatar" | "banner";
  onConfirmed: (payload: File | Blob, meta: { ext: string; contentType: string }) => void;
  avatarBackground?: { avatarShape?: string | null } | null;
}) {
  const { requestCrop, dialog } = useCropConfirm(avatarBackground);
  return (
    <div>
      <button type="button" onClick={() => requestCrop(PNG_FILE, shape, onConfirmed)}>
        pick
      </button>
      {dialog}
    </div>
  );
}

describe("useCropConfirm", () => {
  it("shows the preview, labels the crop, and confirms (canvas-less env passes the file through)", async () => {
    const user = userEvent.setup();
    // 2:1 image against a square (avatar) shape → crop is offered.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1000, height: 500, close: () => undefined }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });

    const onConfirmed = vi.fn();
    render(<Harness shape="avatar" onConfirmed={onConfirmed} />);

    await user.click(screen.getByRole("button", { name: "pick" }));
    expect(await screen.findByText(/will appear/i)).toBeInTheDocument();
    expect(screen.getByText(/trim to the shape/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /crop & upload/i });
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);

    // jsdom has no canvas encoder → cropImageToAspect returns null → the
    // original file passes through with its own meta (the documented fallback).
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    const [payload, meta] = onConfirmed.mock.calls[0];
    expect(payload).toBe(PNG_FILE);
    expect(meta).toEqual({ ext: "png", contentType: "image/png" });
  });

  it("offers plain upload when no crop is needed", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 300, height: 300, close: () => undefined }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });

    render(<Harness shape="avatar" onConfirmed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "pick" }));
    await screen.findByText(/will appear/i);
    expect(screen.getByText(/already fits — it will be uploaded as-is/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("previews avatars in the member's chosen silhouette", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 300, height: 300, close: () => undefined }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });

    render(
      <Harness shape="avatar" onConfirmed={vi.fn()} avatarBackground={{ avatarShape: "hex" }} />,
    );
    await user.click(screen.getByRole("button", { name: "pick" }));
    await screen.findByText(/will appear/i);

    // The preview box carries the hex clip and radius reset exactly as
    // avatarShapeStyle resolves them (via the CSS variables avatarShapeCss
    // consumes) — not the generic rounded square. jsdom doesn't resolve the
    // vars, so assert the variables themselves.
    // (Radix portals the dialog outside the RTL container.)
    const preview = document.querySelector("[style*='blob:preview']") as HTMLElement;
    expect(preview.style.getPropertyValue("--avatar-clip")).toBe(
      avatarShapeStyle({ avatarShape: "hex" })["--avatar-clip"],
    );
    expect(preview.style.getPropertyValue("--avatar-radius")).toBe("0px");
    expect(preview.style.clipPath).toBe("var(--avatar-clip, none)");
  });

  it("previews banners without a silhouette (plain rounded box)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 300, height: 300, close: () => undefined }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });

    render(<Harness shape="banner" onConfirmed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "pick" }));
    await screen.findByText(/will appear/i);
    const preview = document.querySelector("[style*='blob:preview']") as HTMLElement;
    expect(preview.style.clipPath).toBe("");
  });

  it("cancels without calling the uploader", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 100, height: 100, close: () => undefined }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });

    const onConfirmed = vi.fn();
    render(<Harness shape="avatar" onConfirmed={onConfirmed} />);
    await user.click(screen.getByRole("button", { name: "pick" }));
    await screen.findByText(/will appear/i);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
