// Notification bodies as people should read them. Some triggers store a raw
// key in `body` (a recognition's kind); this turns those into words, so no
// notification ever shows `made_clearer`.

const RECOGNITION_KIND_LABELS: Record<string, string> = {
  helpful_feedback: "Helpful feedback",
  strong_iteration: "Strong iteration",
  great_collaborator: "Great collaborator",
  shipped_real: "Shipped something real",
  made_clearer: "Made the project clearer",
};

export function notificationBodyText(notification: {
  type: string;
  body?: string | null;
  metadata?: unknown;
}): string | null {
  const body = notification.body ?? null;
  if (notification.type !== "project_recognition" || !body) return body;
  const label = RECOGNITION_KIND_LABELS[body] ?? body.replace(/_/g, " ");
  const meta = (notification.metadata ?? {}) as { project_title?: unknown };
  return typeof meta.project_title === "string" ? `${label} · ${meta.project_title}` : label;
}
