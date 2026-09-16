import { describe, expect, it } from "vitest";
import type { NotificationType } from "@/hooks/use-notifications";
import {
  ALL_CATEGORIES,
  NEEDS_ACTION_TYPES,
  NOTIFICATION_CATEGORY_VIEWS,
  TYPE_CATEGORY,
  isNotificationMuted,
  notificationViewUnreadCounts,
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

describe("notificationViewUnreadCounts", () => {
  it("returns every view key even when there is nothing unread", () => {
    expect(notificationViewUnreadCounts({}, [])).toEqual({
      all: 0,
      action: 0,
      message: 0,
      session: 0,
      community: 0,
      project: 0,
      reputation: 0,
      achievement: 0,
      moderation: 0,
    });
  });

  it("sums types into their canonical category", () => {
    const counts = notificationViewUnreadCounts(
      { message: 3, session_invite: 1, session_update: 2, follow: 2 },
      [],
    );

    expect(counts.all).toBe(8);
    expect(counts.message).toBe(3);
    expect(counts.session).toBe(3);
    expect(counts.community).toBe(2);
    expect(counts.action).toBe(1); // only session_invite needs action
  });

  it("excludes muted categories from every view, including Needs action", () => {
    const counts = notificationViewUnreadCounts(
      { connection_request: 2, challenge_submitted: 1, message: 4 },
      ["reputation", "community"],
    );

    expect(counts.reputation).toBe(0);
    expect(counts.community).toBe(0);
    expect(counts.all).toBe(4); // message survives; muted categories dropped
    expect(counts.action).toBe(0); // both action types live in muted categories
  });

  it("keeps the result keys aligned with the view catalog", () => {
    const result = notificationViewUnreadCounts({ achievement: 1 }, []);
    expect(Object.keys(result).sort()).toEqual(
      NOTIFICATION_CATEGORY_VIEWS.map((view) => view.key).sort(),
    );
  });
});
