// GitHub language → dot colour, sourced from github/linguist. Single source so
// the project header and the code panel agree on every language.
export const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "#f1e05a",
  typescript: "#3178c6",
  python: "#3572A5",
  rust: "#dea584",
  go: "#00ADD8",
  java: "#b07219",
  kotlin: "#A97BFF",
  swift: "#F05138",
  ruby: "#701516",
  c: "#555555",
  "c++": "#f34b7d",
  "c#": "#178600",
  php: "#4F5D95",
  html: "#e34c26",
  css: "#563d7c",
  scss: "#c6538c",
  shell: "#89e051",
  lua: "#000080",
  r: "#198CE7",
  dart: "#00B4AB",
  elixir: "#6e4a7e",
  haskell: "#5e5086",
  clojure: "#db5855",
  scala: "#c22d40",
  vue: "#41b883",
  svelte: "#ff3e00",
  solidity: "#AA6746",
};

export function languageColor(language?: string | null): string | null {
  if (!language) return null;
  return LANGUAGE_COLORS[language.toLowerCase()] ?? null;
}
