// Models a member can pick for "Explain with AI" (their own Anthropic key).
export const AI_MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 — best explanations" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — faster, cheaper" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — quickest, cheapest" },
] as const;

type AiModel = (typeof AI_MODELS)[number]["id"];

export const isAiModel = (m: unknown): m is AiModel => AI_MODELS.some((x) => x.id === m);
