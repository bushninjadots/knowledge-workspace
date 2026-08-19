// Curated syntax-highlighting instance for the Tiptap code-block extension.
//
// The default `common` language bundle pulls in ~37 highlight.js grammars
// (~220 kB). Registering only the languages this product actually sees keeps
// that bundle a fraction of the size. Unknown languages fall back to
// CodeBlockLowlight's highlightAuto (plain text), so nothing breaks.
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const lowlight = createLowlight({
  bash,
  c,
  cpp,
  csharp,
  css,
  go,
  java,
  javascript,
  json,
  kotlin,
  markdown,
  php,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml,
});

// Common aliases users type in code fences.
lowlight.register("html", xml);
lowlight.register("js", javascript);
lowlight.register("jsx", javascript);
lowlight.register("ts", typescript);
lowlight.register("tsx", typescript);
lowlight.register("sh", bash);
lowlight.register("shell", bash);
lowlight.register("md", markdown);

export default lowlight;
