import { describe, expect, it } from "vitest";
import { getNotificationDestination } from "./notification-destinations";
import type { NotificationType } from "@/hooks/use-notifications";

function notification(type: NotificationType, overrides: Record<string, unknown> = {}) {
  return {
    type,
    entity_id: null,
    metadata: {},
    ...overrides,
  } as Parameters<typeof getNotificationDestination>[0];
}

describe("notification destinations", () => {
  it("routes challenge review outcomes back to the challenge", () => {
    expect(
      getNotificationDestination(notification("challenge_passed", { entity_id: "challenge-1" })),
    ).toEqual({ to: "/challenges/$id", params: { id: "challenge-1" } });
    expect(
      getNotificationDestination(notification("challenge_rejected", { entity_id: "challenge-1" })),
    ).toEqual({ to: "/challenges/$id", params: { id: "challenge-1" } });
  });

  it("falls back to the challenge index when an event has no entity", () => {
    expect(getNotificationDestination(notification("challenge_resubmitted"))).toEqual({
      to: "/challenges",
    });
  });

  it("uses the project metadata attached to role outcomes", () => {
    expect(
      getNotificationDestination(
        notification("role_application_accepted", {
          entity_id: "application-1",
          metadata: { project_id: "project-1" },
        }),
      ),
    ).toEqual({
      to: "/projects/$id",
      params: { id: "project-1" },
      search: { tab: "people" },
    });
  });

  it("covers every declared notification type", () => {
    const types: NotificationType[] = [
      "message",
      "connection_request",
      "connection_accepted",
      "session_invite",
      "session_update",
      "comment",
      "mention",
      "endorsement",
      "achievement",
      "project_invite",
      "project_join",
      "project_post",
      "role_application_accepted",
      "role_application_declined",
      "follow",
      "challenge_join",
      "challenge_complete",
      "challenge_submitted",
      "challenge_resubmitted",
      "challenge_passed",
      "challenge_rejected",
      "join_approved",
      "join_rejected",
      "post_report",
      "report_resolved",
    ];

    for (const type of types) {
      expect(getNotificationDestination(notification(type))).toBeDefined();
    }
  });
});
