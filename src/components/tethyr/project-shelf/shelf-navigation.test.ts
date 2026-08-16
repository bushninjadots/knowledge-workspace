import { describe, expect, it } from "vitest";
import { clamp, dragDirection, wheelStep } from "./shelf-navigation";

describe("clamp", () => {
  it("bounds a value between min and max", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("wheelStep", () => {
  it("accumulates without navigating below the threshold", () => {
    const step = wheelStep(0, 20);
    expect(step.direction).toBeNull();
    expect(step.accumulated).toBe(20);
  });

  it("navigates forward and resets once the threshold is crossed", () => {
    const step = wheelStep(20, 30); // 50 >= 40
    expect(step.direction).toBe(1);
    expect(step.accumulated).toBe(0);
  });

  it("navigates backward for negative deltas", () => {
    const step = wheelStep(0, -45);
    expect(step.direction).toBe(-1);
    expect(step.accumulated).toBe(0);
  });

  it("accumulates negative deltas without navigating below threshold", () => {
    const step = wheelStep(0, -10);
    expect(step.direction).toBeNull();
    expect(step.accumulated).toBe(-10);
  });

  it("respects a custom threshold", () => {
    expect(wheelStep(0, 30, 40).direction).toBeNull();
    expect(wheelStep(0, 30, 20).direction).toBe(1);
  });
});

describe("dragDirection", () => {
  it("advances forward on a leftward drag", () => {
    expect(dragDirection(-80)).toBe(1);
  });

  it("goes backward on a rightward drag", () => {
    expect(dragDirection(80)).toBe(-1);
  });
});
