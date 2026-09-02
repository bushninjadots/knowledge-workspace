import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EDITOR_CHROME_CLASS, EditorChromeBoundary } from "./editor-chrome-boundary";

describe("EditorChromeBoundary", () => {
  it("marks editor controls with the neutral chrome scope", () => {
    render(
      <EditorChromeBoundary className="mb-4">
        <button type="button">Preview</button>
      </EditorChromeBoundary>,
    );

    const boundary = screen.getByRole("button", { name: "Preview" }).parentElement;
    expect(boundary).toHaveClass(EDITOR_CHROME_CLASS, "mb-4");
    expect(boundary).toHaveAttribute("data-editor-chrome");
  });
});
