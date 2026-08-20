import type { NotificationType } from "@/hooks/use-notifications";

type NotificationInput = {
  type: NotificationType;
  entity_id: string | null;
  metadata: Record<string, unknown>;
};

export type NotificationDestination =
  | { to: "/messages" }
  | { to: "/community" }
  | { to: "/sessions" }
  | { to: "/sessions/$id"; params: { id: string } }
  | { to: "/profile" }
  | { to: "/explore" }
  | {
      to: "/projects/$id";
      params: { id: string };
      search: { tab: "people" };
    }
  | { to: "/projects/$id"; params: { id: string } }
  | { to: "/challenges" }
  | { to: "/challenges/$id"; params: { id: string } }
  | { to: "/teams/$slug"; params: { slug: string } };

/**
 * Every notification must resolve to a permission-safe product destination.
 * Entity ids are only used for routes whose page can independently enforce
 * visibility; missing ids fall back to the relevant index route.
 */
export function getNotificationDestination(
  notification: NotificationInput,
): NotificationDestination {
  const { type, entity_id, metadata } = notification;

  switch (type) {
    case "message":
      return { to: "/messages" };
    case "comment":
    case "mention":
      return { to: "/community" };
    case "session_invite":
    case "session_update":
      return entity_id ? { to: "/sessions/$id", params: { id: entity_id } } : { to: "/sessions" };
    case "achievement":
    case "endorsement":
    case "connection_request":
    case "connection_accepted":
    case "follow":
      return { to: "/profile" };
    case "project_invite":
    case "project_join":
    case "project_post":
    case "project_recognition":
      return entity_id ? { to: "/projects/$id", params: { id: entity_id } } : { to: "/explore" };
    case "team_invite": {
      const slug = typeof metadata.team_slug === "string" ? metadata.team_slug : null;
      return slug ? { to: "/teams/$slug", params: { slug } } : { to: "/profile" };
    }
    case "role_application_accepted":
    case "role_application_declined": {
      const projectId = typeof metadata.project_id === "string" ? metadata.project_id : null;
      return projectId
        ? { to: "/projects/$id", params: { id: projectId }, search: { tab: "people" } }
        : { to: "/explore" };
    }
    case "challenge_join":
    case "challenge_complete":
    case "challenge_submitted":
    case "challenge_resubmitted":
    case "challenge_passed":
    case "challenge_rejected":
      return entity_id
        ? { to: "/challenges/$id", params: { id: entity_id } }
        : { to: "/challenges" };
    case "join_approved":
    case "join_rejected":
    case "post_report":
    case "report_resolved":
      return { to: "/community" };
  }
}
