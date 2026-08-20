// Curated syntax-highlighting instance for the Tiptap code-block extension.
//
// The default `common` language bundle pulls in dozens of highlight.js
// grammars. Register only the languages most likely to appear in a project
// README or library note. Unknown languages remain readable as plain text,
// while the editor's initial chunk stays small enough for a fast first open.
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

const lowlight = createLowlight({
  javascript,
  json,
  typescript,
  xml,
});

// Common aliases users type in code fences.
lowlight.register("html", xml);
lowlight.register("js", javascript);
lowlight.register("jsx", javascript);
lowlight.register("ts", typescript);
lowlight.register("tsx", typescript);

export default lowlight;
