import { describe, expect, it } from "vitest";
import type { NotificationType } from "@/hooks/use-notifications";
import {
  ALL_CATEGORIES,
  NEEDS_ACTION_TYPES,
  NOTIFICATION_CATEGORY_VIEWS,
  TYPE_CATEGORY,
  isNotificationMuted,
  typesForNotificationView,
} from "./notification-categories";

describe("notification categories", () => {
  it("assigns every declared notification type to one canonical category", () => {
    const types = Object.keys(TYPE_CATEGORY) as NotificationType[];

    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(ALL_CATEGORIES).toContain(TYPE_CATEGORY[type]);
    }
    expect(new Set(types).size).toBe(types.length);
  });

  it("keeps ordinary category views mutually exclusive", () => {
    const seen = new Map<NotificationType, string>();

    for (const category of ALL_CATEGORIES) {
      const categoryTypes = typesForNotificationView(category);
      expect(categoryTypes).not.toBeNull();
      for (const type of categoryTypes ?? []) {
        expect(seen.has(type)).toBe(false);
        seen.set(type, category);
        expect(TYPE_CATEGORY[type]).toBe(category);
      }
    }

    expect(seen.size).toBe(Object.keys(TYPE_CATEGORY).length);
  });

  it("makes Needs action the only intentional cross-cutting view", () => {
    const actionTypes = typesForNotificationView("action");

    expect(actionTypes).toEqual(NEEDS_ACTION_TYPES);
    for (const type of actionTypes ?? []) {
      expect(ALL_CATEGORIES).toContain(TYPE_CATEGORY[type]);
    }
  });

  it("keeps the view catalog aligned with the supported keys", () => {
    expect(NOTIFICATION_CATEGORY_VIEWS.map((view) => view.key)).toEqual([
      "all",
      "action",
      ...ALL_CATEGORIES,
    ]);
    expect(typesForNotificationView("all")).toBeNull();
  });

  it("resolves mute state through the canonical category", () => {
    expect(isNotificationMuted("connection_request", ["reputation"])).toBe(true);
    expect(isNotificationMuted("connection_request", ["community"])).toBe(false);
    expect(isNotificationMuted("challenge_submitted", ["community"])).toBe(true);
  });
});
