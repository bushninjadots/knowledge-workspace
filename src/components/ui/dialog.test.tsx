import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("Dialog keyboard/focus behavior", () => {
  it("moves focus into the dialog when it opens and returns it to the trigger on close", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open settings</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Adjust your preferences.</DialogDescription>
          </DialogHeader>
          <button type="button">Save</button>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Open settings" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(dialog).toBeInTheDocument();
    // Radix moves focus to the dialog content (the first focusable element).
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape and exposes a close control with an accessible name", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open confirm</DialogTrigger>
        <DialogContent>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open confirm" }));
    expect(await screen.findByRole("dialog", { name: "Are you sure?" })).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
