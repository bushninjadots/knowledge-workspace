import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvailabilitySelector } from "./availability-badge";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

describe("AvailabilitySelector", () => {
  it("renders every status option and Clear status when open", async () => {
    render(<AvailabilitySelector current="available" onSave={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Set availability status" }));

    for (const label of ["Available", "Busy", "Learning", "Looking for Team", "Mentoring"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("option", { name: "Clear status" })).toBeInTheDocument();
  });

  it("opens downward by default (top-full)", async () => {
    render(<AvailabilitySelector current="available" onSave={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Set availability status" }));

    const listbox = screen.getByRole("listbox", { name: "Availability statuses" });
    expect(listbox.className).toContain("top-full");
    expect(listbox.className).not.toContain("bottom-full");
  });

  it("opens upward when openUp is set (bottom-full), so a bottom-anchored trigger isn't cut off", async () => {
    render(<AvailabilitySelector current="available" onSave={() => {}} openUp />);
    await userEvent.click(screen.getByRole("button", { name: "Set availability status" }));

    const listbox = screen.getByRole("listbox", { name: "Availability statuses" });
    expect(listbox.className).toContain("bottom-full");
    expect(listbox.className).not.toContain("top-full");
  });
});
