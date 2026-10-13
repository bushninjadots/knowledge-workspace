// Community views. The page tabs (community-tabs.tsx) show For you,
// Following, Spaces and Saved; post-type views stay valid for deep links
// (?nav=help) and are the type chips in the feed header.

export type CommunityNavId =
  | "home"
  | "communities"
  | "help"
  | "collab"
  | "projects"
  | "questions"
  | "resources"
  | "challenges"
  | "following"
  | "saved"
  | "trending"
  | "showcase"
  | "tip"
  | "discussion";
