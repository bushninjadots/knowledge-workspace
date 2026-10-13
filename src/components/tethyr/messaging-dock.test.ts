import { describe, expect, it } from "vitest";
import { sortConversations } from "./messaging-dock";

describe("sortConversations", () => {
  it("puts unread conversations first and keeps the original order otherwise", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(sortConversations(list, { c: 2, b: 0, d: 1 }).map((c) => c.id)).toEqual([
      "c",
      "d",
      "a",
      "b",
    ]);
  });

  it("leaves the order alone when nothing is unread", () => {
    const list = [{ id: "a" }, { id: "b" }];
    expect(sortConversations(list, {}).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
