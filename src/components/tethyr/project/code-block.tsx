import { lazy, Suspense, useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

// Highlighting runs client-side, so it is code-split into its own chunk even
// though the wrapper below is part of the eager project page. Visitors only
// pay for highlight.js (core + a curated subset of languages) when the README
// actually contains a code block.
const HighlightedCode = lazy(() =>
  import("./code-highlighted").then((m) => ({ default: m.HighlightedCode })),
);

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  zsh: "bash",
  html: "xml",
  md: "markdown",
  yml: "yaml",
  ps1: "powershell",
};

function normalizeCodeLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const lower = language.trim().toLowerCase();
  if (!lower) return undefined;
  return LANGUAGE_ALIASES[lower] ?? lower;
}

function fallbackCopy(code: string) {
  const textarea = document.createElement("textarea");
  textarea.value = code;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = normalizeCodeLanguage(language);
  const lineCount = code.trim() ? code.trim().split("\n").length : 0;

  const copy = useCallback(() => {
    const done = () => {
      setCopied(true);
      toast.success("Code copied");
      window.setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(done)
        .catch(() => {
          fallbackCopy(code);
          done();
        });
      return;
    }
    fallbackCopy(code);
    done();
  }, [code]);

  const languageLabel = lang ? lang.replace(/_/g, " ").toUpperCase() : "TEXT";

  return (
    <div className="code-block group my-3 overflow-hidden rounded-lg border border-border/40 bg-foreground/5">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-background/40 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {languageLabel}
          {lineCount > 1 && <span className="text-muted-foreground/60"> · {lineCount} lines</span>}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          title="Copy code"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-brand-green" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <Suspense fallback={<PlainPre code={code} />}>
        <HighlightedCode code={code} language={lang} />
      </Suspense>
    </div>
  );
}

function PlainPre({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
      <code className="whitespace-pre">{code}</code>
    </pre>
  );
}
