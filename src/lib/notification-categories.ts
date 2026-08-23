import type { NotificationType } from "@/hooks/use-notifications";

/**
 * User-facing notification categories. Each notification type belongs to
 * exactly one category, so a category can be muted without ambiguity and the
 * category tabs never show the same item twice.
 */
export type NotificationCategory =
  | "message"
  | "session"
  | "community"
  | "project"
  | "reputation"
  | "achievement"
  | "moderation";

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

/**
 * The action queue is intentionally cross-cutting: these events require a
 * decision or reply, while their canonical category remains the owner of
 * preferences and ordinary category browsing.
 */
export const NEEDS_ACTION_TYPES: readonly NotificationType[] = [
  "connection_request",
  "session_invite",
  "project_invite",
  "team_invite",
  "role_application_accepted",
  "role_application_declined",
  "challenge_submitted",
  "challenge_resubmitted",
];

export const NOTIFICATION_CATEGORY_VIEWS = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs action" },
  ...ALL_CATEGORIES.map((category) => ({
    key: category,
    label: CATEGORY_LABELS[category],
  })),
] as const;

export type NotificationCategoryViewKey = (typeof NOTIFICATION_CATEGORY_VIEWS)[number]["key"];

export function isNotificationCategoryViewKey(
  value: string,
): value is NotificationCategoryViewKey {
  return NOTIFICATION_CATEGORY_VIEWS.some((view) => view.key === value);
}

export function typesForNotificationView(
  view: NotificationCategoryViewKey,
): readonly NotificationType[] | null {
  if (view === "all") return null;
  if (view === "action") return NEEDS_ACTION_TYPES;
  return (Object.entries(TYPE_CATEGORY) as [NotificationType, NotificationCategory][])
    .filter(([, category]) => category === view)
    .map(([type]) => type);
}

export function isNotificationMuted(
  type: NotificationType,
  mutedCategories: readonly NotificationCategory[],
): boolean {
  return mutedCategories.includes(TYPE_CATEGORY[type]);
}
