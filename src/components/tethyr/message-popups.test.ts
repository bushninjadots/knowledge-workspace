import { describe, expect, it } from "vitest";
import { addMessagePopup, type MessagePopup } from "./message-popups";

const msg = (connectionId: string, preview: string, receivedAt = 1) => ({
  connectionId,
  actorId: `actor-${connectionId}`,
  preview,
  receivedAt,
});

describe("addMessagePopup", () => {
  it("puts the newest conversation on top", () => {
    let stack: MessagePopup[] = [];
    stack = addMessagePopup(stack, msg("a", "hi"));
    stack = addMessagePopup(stack, msg("b", "hey"));
    expect(stack.map((p) => p.connectionId)).toEqual(["b", "a"]);
  });

  it("merges more messages from the same conversation into one card", () => {
    let stack: MessagePopup[] = [];
    stack = addMessagePopup(stack, msg("a", "first", 1));
    stack = addMessagePopup(stack, msg("b", "other", 2));
    stack = addMessagePopup(stack, msg("a", "second", 3));
    expect(stack).toHaveLength(2);
    expect(stack[0]).toMatchObject({
      connectionId: "a",
      preview: "second",
      count: 2,
      receivedAt: 3,
    });
  });

  it("keeps at most three cards", () => {
    let stack: MessagePopup[] = [];
    for (const id of ["a", "b", "c", "d"]) stack = addMessagePopup(stack, msg(id, id));
    expect(stack.map((p) => p.connectionId)).toEqual(["d", "c", "b"]);
  });
});
