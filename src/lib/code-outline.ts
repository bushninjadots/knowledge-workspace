// ── Code → docs, without AI ───────────────────────────────────────────────────
// Reads a source file and writes a readable outline in Markdown: what the file
// is, what it defines (functions, classes, types, exports) with the doc
// comments the author already wrote, what it depends on, and what's left to
// do. Pattern-based, so it works offline, costs nothing, and never sends code
// anywhere. The optional AI pass (bring your own key) rewrites this into plain
// language — see src/lib/code-docs-ai.ts.

type Declaration = {
  kind:
    "function" | "class" | "type" | "interface" | "const" | "method" | "struct" | "enum" | "trait";
  name: string;
  signature: string;
  doc: string | null;
  exported: boolean;
  line: number;
};

type CodeOutline = {
  language: string;
  lines: number;
  summary: string | null;
  declarations: Declaration[];
  imports: { external: string[]; local: string[] };
  todos: { line: number; text: string }[];
};

const LANGUAGES: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript (React)",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript (React)",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  cs: "C#",
  rb: "Ruby",
  php: "PHP",
  swift: "Swift",
  dart: "Dart",
  scala: "Scala",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  hpp: "C++",
  lua: "Lua",
  sh: "Shell",
  bash: "Shell",
  sql: "SQL",
  vue: "Vue",
  svelte: "Svelte",
  ex: "Elixir",
  exs: "Elixir",
};

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGES[ext] ?? "Code";
}

type Family = "js" | "py" | "go" | "rust" | "c-like" | "ruby" | "php" | "other";

function family(language: string): Family {
  if (/TypeScript|JavaScript|Vue|Svelte/.test(language)) return "js";
  if (language === "Python") return "py";
  if (language === "Go") return "go";
  if (language === "Rust") return "rust";
  if (/Java|Kotlin|C#|Swift|Dart|Scala|C\+\+|^C$/.test(language)) return "c-like";
  if (language === "Ruby" || language === "Elixir") return "ruby";
  if (language === "PHP") return "php";
  return "other";
}

/** Strip comment markers from a doc block: /** … *\/, ///, //, #. */
function cleanDoc(raw: string[]): string | null {
  const text = raw
    .map((l) =>
      l
        .replace(/^\s*\/\*\*?/, "")
        .replace(/\*\/\s*$/, "")
        .replace(/^\s*\*\s?/, "")
        .replace(/^\s*\/\/\/?\s?/, "")
        .replace(/^\s*#\s?/, "")
        .trim(),
    )
    .filter((l) => l && !/^@(param|returns?|throws|example)\b/.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** The comment block directly above line `i` (no blank line in between). */
function docAbove(lines: string[], i: number, fam: Family): string | null {
  const block: string[] = [];
  let j = i - 1;
  // Decorators / attributes sit between the doc and the declaration.
  while (j >= 0 && /^\s*(@\w|#\[)/.test(lines[j])) j--;
  if (j >= 0 && /\*\/\s*$/.test(lines[j])) {
    while (j >= 0) {
      block.unshift(lines[j]);
      if (/^\s*\/\*/.test(lines[j])) break;
      j--;
    }
    return cleanDoc(block);
  }
  const lineComment = fam === "py" || fam === "ruby" ? /^\s*#/ : /^\s*\/\//;
  while (j >= 0 && lineComment.test(lines[j])) {
    block.unshift(lines[j]);
    j--;
  }
  return block.length ? cleanDoc(block) : null;
}

/** A Python docstring right under a def/class. */
function docstringBelow(lines: string[], i: number): string | null {
  const next = lines[i + 1]?.trim() ?? "";
  const quote = next.startsWith('"""') ? '"""' : next.startsWith("'''") ? "'''" : null;
  if (!quote) return null;
  const rest = next.slice(3);
  if (rest.includes(quote)) return rest.slice(0, rest.indexOf(quote)).trim() || null;
  const body = [rest];
  for (let k = i + 2; k < Math.min(lines.length, i + 40); k++) {
    const l = lines[k];
    if (l.includes(quote)) {
      body.push(l.slice(0, l.indexOf(quote)));
      break;
    }
    body.push(l);
  }
  return cleanDoc(body.map((b) => b.trim()));
}

const sig = (text: string) =>
  text
    .replace(/\s*\{\s*$/, "")
    .replace(/\s*=>\s*\{?\s*$/, "")
    .replace(/:\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

type Rule = { re: RegExp; kind: Declaration["kind"]; exported?: (m: RegExpMatchArray) => boolean };

const RULES: Record<Family, Rule[]> = {
  js: [
    {
      re: /^(export\s+(?:default\s+)?)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/,
      kind: "function",
    },
    { re: /^(export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: "class" },
    { re: /^(export\s+)?interface\s+([A-Za-z_$][\w$]*)/, kind: "interface" },
    { re: /^(export\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*=/, kind: "type" },
    { re: /^(export\s+)?enum\s+([A-Za-z_$][\w$]*)/, kind: "enum" },
    {
      re: /^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/,
      kind: "function",
    },
    { re: /^(export\s+)const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/, kind: "const" },
  ],
  py: [
    {
      re: /^()(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,
      kind: "function",
      exported: (m) => !m[2].startsWith("_"),
    },
    { re: /^()class\s+([A-Za-z_]\w*)/, kind: "class", exported: (m) => !m[2].startsWith("_") },
  ],
  go: [
    {
      re: /^()func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*\(/,
      kind: "function",
      exported: (m) => /^[A-Z]/.test(m[2]),
    },
    {
      re: /^()type\s+([A-Za-z_]\w*)\s+struct\b/,
      kind: "struct",
      exported: (m) => /^[A-Z]/.test(m[2]),
    },
    {
      re: /^()type\s+([A-Za-z_]\w*)\s+interface\b/,
      kind: "interface",
      exported: (m) => /^[A-Z]/.test(m[2]),
    },
    { re: /^()type\s+([A-Za-z_]\w*)\s+/, kind: "type", exported: (m) => /^[A-Z]/.test(m[2]) },
  ],
  rust: [
    {
      re: /^(pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/,
      kind: "function",
    },
    { re: /^(pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)/, kind: "struct" },
    { re: /^(pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/, kind: "enum" },
    { re: /^(pub(?:\([^)]*\))?\s+)?trait\s+([A-Za-z_]\w*)/, kind: "trait" },
  ],
  "c-like": [
    {
      re: /^((?:public|export)\s+)?(?:(?:private|protected|internal|static|final|abstract|sealed|open|data|partial)\s+)*(?:class|record|object)\s+([A-Za-z_]\w*)/,
      kind: "class",
    },
    {
      re: /^((?:public|export)\s+)?(?:(?:private|protected|internal)\s+)?interface\s+([A-Za-z_]\w*)/,
      kind: "interface",
    },
    { re: /^((?:public|export)\s+)?enum\s+(?:class\s+)?([A-Za-z_]\w*)/, kind: "enum" },
    {
      re: /^((?:public)\s+)?(?:(?:static|final|async|override|virtual|abstract|suspend)\s+)*fun\s+([A-Za-z_]\w*)/,
      kind: "function",
    },
    { re: /^((?:public)\s+)?func\s+([A-Za-z_]\w*)/, kind: "function" },
    {
      re: /^((?:public)\s+)(?:(?:static|final|async|override|virtual|abstract|synchronized)\s+)*[\w<>[\],.?]+\s+([A-Za-z_]\w*)\s*\(/,
      kind: "method",
    },
  ],
  ruby: [
    { re: /^()def\s+(?:self\.)?([A-Za-z_]\w*[!?]?)/, kind: "function", exported: () => true },
    { re: /^()(?:class|module)\s+([A-Z]\w*)/, kind: "class", exported: () => true },
    { re: /^()defp?\s+([a-z_]\w*[!?]?)/, kind: "function", exported: () => true },
  ],
  php: [
    { re: /^((?:public)\s+)?(?:static\s+)?function\s+([A-Za-z_]\w*)\s*\(/, kind: "function" },
    {
      re: /^()(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/,
      kind: "class",
      exported: () => true,
    },
  ],
  other: [],
};

function declarations(lines: string[], fam: Family): Declaration[] {
  const out: Declaration[] = [];
  lines.forEach((raw, i) => {
    // Top level only (methods inside classes count for c-like/php/ruby).
    const indent = raw.length - raw.trimStart().length;
    const nested = fam === "c-like" || fam === "php" || fam === "ruby" ? indent > 8 : indent > 0;
    if (nested) return;
    const line = raw.trim();
    for (const rule of RULES[fam]) {
      const m = line.match(rule.re);
      if (!m) continue;
      const name = m[2];
      if (!name || out.some((d) => d.name === name && d.kind === rule.kind)) break;
      const exported = rule.exported ? rule.exported(m) : !!m[1];
      const doc =
        fam === "py"
          ? (docstringBelow(lines, i) ?? docAbove(lines, i, fam))
          : docAbove(lines, i, fam);
      out.push({ kind: rule.kind, name, signature: sig(line), doc, exported, line: i + 1 });
      break;
    }
  });
  return out;
}

function imports(lines: string[], fam: Family): CodeOutline["imports"] {
  const found = new Set<string>();
  const text = lines.join("\n");
  const add = (spec: string | undefined) => spec && found.add(spec.trim());
  if (fam === "js") {
    for (const m of text.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g)) add(m[1]);
    for (const m of text.matchAll(/(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1]);
    for (const m of text.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) add(m[1]);
  } else if (fam === "py") {
    for (const m of text.matchAll(/^\s*from\s+([.\w]+)\s+import/gm)) add(m[1]);
    for (const m of text.matchAll(/^\s*import\s+([.\w]+)/gm)) add(m[1]);
  } else if (fam === "go") {
    for (const m of text.matchAll(/"([\w./-]+)"/g))
      if (/^import|^\s/.test(text.slice(Math.max(0, (m.index ?? 0) - 40), m.index))) add(m[1]);
  } else if (fam === "rust") {
    for (const m of text.matchAll(/^\s*use\s+([\w:]+)/gm)) add(m[1].split("::")[0]);
  } else if (fam === "c-like") {
    for (const m of text.matchAll(/^\s*(?:import|using)\s+([\w.]+)/gm)) add(m[1]);
    for (const m of text.matchAll(/^\s*#include\s+[<"]([^>"]+)[>"]/gm)) add(m[1]);
  } else if (fam === "ruby") {
    for (const m of text.matchAll(/^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/gm)) add(m[1]);
  } else if (fam === "php") {
    for (const m of text.matchAll(/^\s*use\s+([\w\\]+)/gm)) add(m[1]);
  }
  // Local: relative paths, "~/…" and the "@/…" alias. Scoped packages
  // ("@tanstack/react-query") are external.
  const isLocal = (spec: string) =>
    spec.startsWith("@/") || spec.startsWith(".") || spec.startsWith("~/") || spec.startsWith("/");
  const local = [...found].filter(isLocal);
  const external = [...found].filter((s) => !local.includes(s));
  return { external: external.slice(0, 30), local: local.slice(0, 30) };
}

function fileSummary(lines: string[], fam: Family): string | null {
  // A leading comment block (after a shebang / "use strict") describes the file.
  let i = 0;
  while (
    i < lines.length &&
    (/^#!/.test(lines[i]) || /^\s*$/.test(lines[i]) || /^['"]use /.test(lines[i]))
  )
    i++;
  if (fam === "py") {
    const doc = docstringBelow(["", ...lines.slice(i)], 0);
    if (doc) return doc;
  }
  const block: string[] = [];
  const comment = fam === "py" || fam === "ruby" ? /^\s*#/ : /^\s*(\/\/|\/\*|\*)/;
  while (i < lines.length && comment.test(lines[i])) {
    block.push(lines[i]);
    i++;
  }
  // A block that's just a license header isn't a description.
  const text = cleanDoc(block);
  return text && !/copyright|license|SPDX/i.test(text.slice(0, 80)) ? text : null;
}

export function outlineCode(source: string, filename: string): CodeOutline {
  const language = detectLanguage(filename);
  const fam = family(language);
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const todos = lines.flatMap((l, i) => {
    const m = l.match(/(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|XXX)\b[:\s-]*(.*)$/i);
    return m
      ? [{ line: i + 1, text: `${m[1].toUpperCase()}: ${m[2].replace(/\*\/\s*$/, "").trim()}` }]
      : [];
  });
  return {
    language,
    lines: lines.length,
    summary: fileSummary(lines, fam),
    declarations: declarations(lines, fam),
    imports: imports(lines, fam),
    todos: todos.slice(0, 30),
  };
}

const KIND_LABEL: Record<Declaration["kind"], string> = {
  function: "Function",
  method: "Method",
  class: "Class",
  type: "Type",
  interface: "Interface",
  const: "Constant",
  struct: "Struct",
  enum: "Enum",
  trait: "Trait",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The outline as a Markdown doc a newcomer can read. */
export function outlineToMarkdown(outline: CodeOutline, filename: string): string {
  const { declarations: decls } = outline;
  const exported = decls.filter((d) => d.exported);
  const shown = exported.length ? exported : decls;
  const undocumented = shown.filter((d) => !d.doc).length;
  const out: string[] = [`# ${filename}`, ""];
  out.push(
    `_${outline.language} · ${plural(outline.lines, "line")} · ${plural(shown.length, exported.length ? "public part" : "definition")}${undocumented ? ` · ${undocumented} without a description yet` : ""}_`,
    "",
  );
  if (outline.summary) out.push("## What this file is", "", outline.summary, "");

  if (shown.length) {
    out.push(exported.length ? "## What it offers" : "## What's inside", "");
    for (const d of shown) {
      out.push(`### ${KIND_LABEL[d.kind]} \`${d.name}\``, "");
      out.push(d.doc ?? "_No description in the code yet._", "");
      out.push("```", d.signature, "```", "");
    }
    const internal = decls.filter((d) => !d.exported);
    if (exported.length && internal.length)
      out.push(
        "## Internal helpers",
        "",
        internal.map((d) => `- \`${d.name}\`${d.doc ? ` — ${d.doc}` : ""}`).join("\n"),
        "",
      );
  } else {
    out.push(
      "_No functions, classes or types found — this file may be config, data or markup._",
      "",
    );
  }

  const { external, local } = outline.imports;
  if (external.length || local.length) {
    out.push("## Depends on", "");
    if (external.length) out.push(`- **Packages:** ${external.map((e) => `\`${e}\``).join(", ")}`);
    if (local.length)
      out.push(`- **Other files in the project:** ${local.map((e) => `\`${e}\``).join(", ")}`);
    out.push("");
  }
  if (outline.todos.length)
    out.push(
      "## Still to do",
      "",
      outline.todos.map((t) => `- Line ${t.line} — ${t.text}`).join("\n"),
      "",
    );
  return out.join("\n").trimEnd() + "\n";
}
