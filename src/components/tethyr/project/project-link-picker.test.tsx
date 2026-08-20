import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ProjectLinkPicker } from "./project-link-picker";
import { createFakeSupabase } from "../../../../tests/helpers/fake-supabase";

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

function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseProps = {
  placeholder: "Previous project (optional)",
  ariaLabel: "Previous project",
  excludeProjectId: "current-project",
  ownerId: "owner-1",
};

beforeEach(() => {
  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
});

describe("ProjectLinkPicker", () => {
  it("shows the title of the selected project", async () => {
    handle.on("projects:select", () => ({ data: { id: "p1", title: "Alpha" }, error: null }));
    renderWithProviders(<ProjectLinkPicker value="p1" onChange={vi.fn()} {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Previous project" })).toHaveValue("Alpha"),
    );
  });

  it("clears the link", async () => {
    handle.on("projects:select", () => ({ data: { id: "p1", title: "Alpha" }, error: null }));
    const onChange = vi.fn();
    renderWithProviders(<ProjectLinkPicker value="p1" onChange={onChange} {...baseProps} />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Previous project" })).toHaveValue("Alpha"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear Previous project" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("searches the owner's projects and selects a match", async () => {
    handle.on("projects:select", () => ({
      data: [
        { id: "p1", title: "Alpha" },
        { id: "p2", title: "Alpine" },
      ],
      error: null,
    }));
    const onChange = vi.fn();
    renderWithProviders(<ProjectLinkPicker value={null} onChange={onChange} {...baseProps} />);
    const input = screen.getByRole("textbox", { name: "Previous project" });
    await userEvent.type(input, "Al");
    await waitFor(() => expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onChange).toHaveBeenCalledWith("p1");
  });

  it("shows an empty message when no projects match", async () => {
    handle.on("projects:select", () => ({ data: [], error: null }));
    renderWithProviders(<ProjectLinkPicker value={null} onChange={vi.fn()} {...baseProps} />);
    const input = screen.getByRole("textbox", { name: "Previous project" });
    await userEvent.type(input, "zz");
    await waitFor(() => expect(screen.getByText("No matching projects")).toBeInTheDocument());
  });
});
