// Curated syntax-highlighting instance for the Tiptap code-block extension.
//
// The default `common` bundle pulls in dozens of grammars; register the
// languages that actually appear in project READMEs and library notes — the
// ten most common programming languages plus markup/data formats. Unknown
// languages remain readable as plain text while keeping the editor chunk
// small enough for a fast first open.
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import sql from "highlight.js/lib/languages/sql";

const lowlight = createLowlight({
  javascript,
  json,
  typescript,
  xml,
  css,
  python,
  java,
  c,
  cpp,
  csharp,
  go,
  rust,
  php,
  ruby,
  sql,
  bash,
  yaml,
});

// Common aliases users type in code fences.
lowlight.register("html", xml);
lowlight.register("js", javascript);
lowlight.register("jsx", javascript);
lowlight.register("ts", typescript);
lowlight.register("tsx", typescript);
lowlight.register("py", python);
lowlight.register("sh", bash);
lowlight.register("shell", bash);
lowlight.register("zsh", bash);
lowlight.register("yml", yaml);
lowlight.register("golang", go);
lowlight.register("cs", csharp);

/**
 * Options for the editor's code-block language picker. Values must match
 * registered lowlight names/aliases so highlighting actually applies; the
 * leading "none" entry clears the block's language.
 */
export const CODE_LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash / Shell" },
  { value: "yaml", label: "YAML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
];

export default lowlight;
