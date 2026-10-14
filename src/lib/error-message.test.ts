import { describe, expect, it } from "vitest";
import { friendlyError } from "./error-message";

describe("friendlyError", () => {
  it("shows the sentence from a server guard, not its code", () => {
    expect(
      friendlyError(
        new Error("email_unconfirmed: Confirm your email before connecting with people."),
      ),
    ).toBe("Confirm your email before connecting with people.");
    expect(friendlyError({ message: "rate_limited: Try again tomorrow." })).toBe(
      "Try again tomorrow.",
    );
  });

  it("hides database internals", () => {
    expect(friendlyError(new Error("new row violates row-level security policy"), "Nope")).toBe(
      "Nope",
    );
  });

  it("passes plain validation messages through", () => {
    expect(friendlyError(new Error("Invalid login credentials"))).toBe("Invalid login credentials");
  });
});
