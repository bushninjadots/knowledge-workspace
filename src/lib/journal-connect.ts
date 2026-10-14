// Setup snippets for connecting a member's tools to their dev journal. Pure
// strings, so the page and tests agree on exactly what people paste.

type ConnectTarget = {
  id: string;
  label: string;
  /** Where this goes, in one line. */
  where: string;
  language: "bash" | "json";
  snippet: (origin: string, token: string) => string;
  note?: string;
};

const mcpUrl = (origin: string, client: string) => `${origin}/api/mcp?client=${client}`;

export const CONNECT_TARGETS: ConnectTarget[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    where: "Run once in your terminal",
    language: "bash",
    snippet: (o, t) =>
      `claude mcp add --transport http --scope user tethyr "${mcpUrl(o, "claude-code")}" \\\n  --header "Authorization: Bearer ${t}"`,
    note: 'Then just work. Claude logs the important parts — or ask "log this to Tethyr", and run /mcp__tethyr__wrap_up at the end of a session.',
  },
  {
    id: "cursor",
    label: "Cursor",
    where: "~/.cursor/mcp.json",
    language: "json",
    snippet: (o, t) =>
      JSON.stringify(
        {
          mcpServers: {
            tethyr: { url: mcpUrl(o, "cursor"), headers: { Authorization: `Bearer ${t}` } },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "vscode",
    label: "VS Code (Copilot)",
    where: ".vscode/mcp.json, or your user MCP settings",
    language: "json",
    snippet: (o, t) =>
      JSON.stringify(
        {
          servers: {
            tethyr: {
              type: "http",
              url: mcpUrl(o, "vscode"),
              headers: { Authorization: `Bearer ${t}` },
            },
          },
        },
        null,
        2,
      ),
    note: "Use Copilot Chat in agent mode; the Tethyr tools appear in its tool list.",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    where: "~/.codeium/windsurf/mcp_config.json",
    language: "json",
    snippet: (o, t) =>
      JSON.stringify(
        {
          mcpServers: {
            tethyr: {
              serverUrl: mcpUrl(o, "windsurf"),
              headers: { Authorization: `Bearer ${t}` },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: "git",
    label: "Git hook (any host)",
    where: "Save as .git/hooks/post-commit, then chmod +x",
    language: "bash",
    snippet: (o, t) =>
      [
        "#!/bin/sh",
        "# Tethyr: feat/fix commits (and anything tagged [log]) go to your dev journal.",
        "# Works with GitHub, GitLab, Bitbucket or no remote at all.",
        `git log -1 --pretty=%B | curl -s -m 5 -X POST "${o}/api/journal" \\`,
        `  -H "Authorization: Bearer ${t}" -H "Content-Type: text/plain" \\`,
        "  --data-binary @- >/dev/null 2>&1 &",
      ].join("\n"),
    note: "For every repo at once: put it in ~/.githooks and run git config --global core.hooksPath ~/.githooks",
  },
  {
    id: "terminal",
    label: "Terminal",
    where: "Add to ~/.bashrc or ~/.zshrc",
    language: "bash",
    snippet: (o, t) =>
      [
        '# tlog learned "how Postgres advisory locks work"',
        "tlog() {",
        "  kind=$1; shift",
        `  curl -s -X POST "${o}/api/journal" -H "Authorization: Bearer ${t}" \\`,
        '    -H "Content-Type: application/json" \\',
        '    -d "{\\"kind\\":\\"$kind\\",\\"body\\":\\"$*\\",\\"source\\":\\"cli\\"}" >/dev/null && echo "logged"',
        "}",
      ].join("\n"),
    note: "Kinds: did, fixed, decided, learned, stuck, next.",
  },
  {
    id: "obsidian",
    label: "Obsidian",
    where: "Shell commands plugin, or the brag doc download",
    language: "bash",
    snippet: (o, t) =>
      [
        "# Shell commands plugin → a command that logs the current selection:",
        `curl -s -X POST "${o}/api/journal" -H "Authorization: Bearer ${t}" \\`,
        '  -H "Content-Type: application/json" \\',
        '  -d "{\\"kind\\":\\"learned\\",\\"body\\":\\"{{selection}}\\",\\"source\\":\\"obsidian\\"}"',
      ].join("\n"),
    note: "The other way round: download your monthly brag doc (.md) straight into your vault.",
  },
];

export const TOKEN_PLACEHOLDER = "YOUR_TETHYR_TOKEN";
