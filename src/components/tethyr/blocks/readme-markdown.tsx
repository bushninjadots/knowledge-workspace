// ── Shared README / About read renderer ──────────────────────────────────────
// The one read-mode surface for markdown body content on profile README and
// About blocks: react-markdown with GFM, and fenced code blocks promoted to
// the shared CodeBlock (highlighting + copy) exactly like the project README.

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/tethyr/project/code-block";

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
};

/** Recover the fenced block's text + language from the `<pre>`'s `<code>` node. */
function blockCodeFromPre(node: HastNode | undefined): { code: string; language?: string } | null {
  const codeNode = node?.children?.find(
    (child) => child.type === "element" && child.tagName === "code",
  );
  if (!codeNode?.children?.length) return null;
  const code = codeNode.children
    .map((child) => (child.type === "text" ? (child.value ?? "") : ""))
    .join("");
  const rawClass = codeNode.properties?.className;
  const classes = Array.isArray(rawClass)
    ? rawClass.join(" ")
    : typeof rawClass === "string"
      ? rawClass
      : "";
  return { code: code.replace(/\n$/, ""), language: /language-([\w-]+)/.exec(classes)?.[1] };
}

/** Read-mode renderer: fenced blocks become copyable CodeBlocks. */
function MarkdownPre(props: React.ComponentProps<"pre">) {
  const node = (props as React.ComponentProps<"pre"> & { node?: HastNode }).node;
  const parsed = blockCodeFromPre(node);
  if (!parsed) return <pre {...props} />;
  return <CodeBlock code={parsed.code} language={parsed.language} />;
}

/** Shared overrides so preview and read views render code identically. */
export const MARKDOWN_COMPONENTS: Components = { pre: MarkdownPre };

/** Render markdown body content in the prose-custom container. */
export function ReadmeMarkdown({ children }: { children: string }) {
  return (
    <div className="prose-custom text-sm leading-relaxed text-foreground">
      <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {children || "_Nothing here yet._"}
      </Markdown>
    </div>
  );
}

/** Accept "octocat", "@octocat", "github.com/octocat", or a full profile URL. */
export function extractGithubUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^@/, "");
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/github\.com\/([^/?#\s]+)/i);
  if (fromUrl) return fromUrl[1];
  if (/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(trimmed)) return trimmed;
  return null;
}
