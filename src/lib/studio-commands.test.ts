import { describe, expect, it } from "vitest";
import { filterCommands, type StudioCommand } from "./studio-commands";

const command = (label: string, group: StudioCommand["group"], keywords?: string) => ({
  id: label,
  label,
  group,
  keywords,
  run: () => {},
});

const commands = [
  command("Add Heading", "Add a block"),
  command("Undo", "Page"),
  command("Remove block", "Selection", "delete"),
  command("Heading · About", "Go to a block"),
  command("About · About", "Go to a block", "heading"),
  command("Publish", "Page"),
];

const labels = (list: StudioCommand[]) => list.map((item) => item.label);

describe("filterCommands", () => {
  it("lists actions, not the long block lists, before anything is typed", () => {
    expect(labels(filterCommands(commands, ""))).toEqual(["Remove block", "Undo", "Publish"]);
  });

  it("needs every word typed, in label, keywords or group", () => {
    expect(labels(filterCommands(commands, "delete"))).toEqual(["Remove block"]);
    expect(labels(filterCommands(commands, "add head"))).toEqual(["Add Heading"]);
  });

  it("keeps groups together, leading with the one whose label starts with the query", () => {
    expect(labels(filterCommands(commands, "heading"))).toEqual([
      "Heading · About",
      "About · About",
      "Add Heading",
    ]);
  });
});
