// React Query keys for project pages, shared by the use-project* hook modules.

export const PROJECT_KEY = (id: string) => ["project-detail", id] as const;
export const MILESTONES_KEY = (projectId: string) => ["milestones", projectId] as const;
export const PROJECT_UPDATES_KEY = (projectId: string) => ["project-updates", projectId] as const;
export const DISCUSSIONS_KEY = (projectId: string) => ["discussions", projectId] as const;
export const DISCUSSION_REPLIES_KEY = (discussionId: string) =>
  ["discussion-replies", discussionId] as const;
export const OPEN_ROLES_KEY = (projectId: string) => ["open-roles", projectId] as const;
export const PROJECT_ACTIVITY_KEY = (projectId: string) => ["project-activity", projectId] as const;
