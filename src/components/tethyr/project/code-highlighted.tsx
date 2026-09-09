// Lazy-loaded code highlighting. Lives in its own chunk so highlight.js core
// + the registered languages stay out of the eager README bundle. Uses a small
// curated subset — READMEs ship mostly JS/TS/Python/shell/JSON/CSS/HTML.
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import { useMemo } from "react";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("dockerfile", dockerfile);

export function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const html = useMemo(() => {
    if (!language || !hljs.getLanguage(language)) return null;
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  }, [code, language]);

  if (html === null) {
    return (
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-foreground/85">
        <code className="whitespace-pre">{code}</code>
      </pre>
    );
  }

  return (
    <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">
      {/* Styled via .hljs token overrides in styles.css — never inline colors. */}
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
