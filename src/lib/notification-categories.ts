import type { NotificationType } from "@/hooks/use-notifications";

/**
 * User-facing notification categories. Each notification type belongs to
 * exactly one category, so a category can be muted without ambiguity and the
 * Notifications page tabs never show the same item twice.
 */
export type NotificationCategory =
  "message" | "session" | "community" | "project" | "reputation" | "achievement" | "moderation";

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  message: "Messages",
  session: "Sessions",
  community: "Community",
  project: "Projects",
  reputation: "Reputation",
  achievement: "Achievements",
  moderation: "Moderation",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as NotificationCategory[];

/** Single canonical home for every notification type. */
export const TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  message: "message",
  session_invite: "session",
  session_update: "session",
  comment: "community",
  mention: "community",
  follow: "community",
  challenge_join: "community",
  challenge_complete: "community",
  challenge_submitted: "community",
  challenge_resubmitted: "community",
  challenge_passed: "community",
  challenge_rejected: "community",
  join_approved: "community",
  join_rejected: "community",
  project_invite: "project",
  project_join: "project",
  project_post: "project",
  project_recognition: "project",
  team_invite: "project",
  role_application_accepted: "project",
  role_application_declined: "project",
  endorsement: "reputation",
  connection_request: "reputation",
  connection_accepted: "reputation",
  achievement: "achievement",
  post_report: "moderation",
  report_resolved: "moderation",
};
