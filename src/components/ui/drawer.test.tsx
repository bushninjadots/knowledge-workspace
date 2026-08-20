import { describe, expect, it, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "./drawer";

// jsdom lacks matchMedia — vaul uses it to detect the desktop breakpoint.
beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    (((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia);
});

describe("Drawer keyboard/focus behavior", () => {
  it("opens from the trigger and exposes the panel as a dialog with a title", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <DrawerTrigger>Open navigation</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Navigation</DrawerTitle>
          </DrawerHeader>
          <button type="button">Community</button>
        </DrawerContent>
      </Drawer>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Community" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <DrawerTrigger>Open navigation</DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>Navigation</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByRole("dialog", { name: "Navigation" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });
});
