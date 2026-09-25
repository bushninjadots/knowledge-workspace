import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "g/**",
      ".output",
      ".vinxi",
      "supabase/.temp/**",
      "supabase/.branches/**",
      "src/integrations/supabase/types.ts",
      ".venv/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      // This repo exports helper constants and utility values alongside
      // component functions in several shared UI files. Those patterns are
      // valid and useful here, so disable the React Fast Refresh rule.
      "react-refresh/only-export-components": "off",
      // `_`-prefixed params/vars are the repo's intentional "kept for the
      // signature but unused" convention (callbacks, destructured props).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-restricted-syntax": [
        "error",
        // One control grammar (docs/TETHYR_DESIGN_SYSTEM.md): form fields go
        // through the shared primitives so focus rings, sizing, and error
        // affordances can't drift per surface. Native selects survive only
        // where a portalled popover would break the surface (the Tiptap editor
        // toolbars, studio chrome) — each one carries an eslint-disable.
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "Use the shared Select primitive (@/components/ui/select) instead of a raw <select>. Native selects are only allowed where a portalled popover would break the surface (editor toolbars, studio chrome) — add an eslint-disable with the reason.",
        },
        // The retired `brand-*` token aliases are gone from styles.css: the
        // semantic names are the only ones (trust/ai, trust-subtle, ...).
        {
          selector: "Literal[value=/brand-(green|purple|deep-forest|dark-slate|soft-ivory)/]",
          message:
            "Retired token name. Use the semantic token instead: --trust / --ai (was brand-green / brand-purple).",
        },
        {
          selector:
            "TemplateElement[value.raw=/brand-(green|purple|deep-forest|dark-slate|soft-ivory)/]",
          message:
            "Retired token name. Use the semantic token instead: --trust / --ai (was brand-green / brand-purple).",
        },
        // Motion policy (styles.css): name transition properties explicitly,
        // never transition-all. Keep durations under 300ms.
        {
          selector: "Literal[value=/transition-all/]",
          message:
            "Avoid transition-all — name transition properties explicitly (transition-colors, transition-opacity, transition-[width], etc.) per the motion policy.",
        },
        {
          selector: "TemplateElement[value.raw=/transition-all/]",
          message:
            "Avoid transition-all — name transition properties explicitly (transition-colors, transition-opacity, transition-[width], etc.) per the motion policy.",
        },
        // Search-term escaping (lib/search.ts): a raw term interpolated into an
        // ilike value inside an .or() filter breaks or silently rewrites the
        // filter when it contains , % ( ) |. Build the filter with
        // ilikeOrFilter(columns, term) instead — escaping and % wrapping live
        // there. Template quasis are split around interpolations, so the
        // detectable shape is a quasi ENDING in `.ilike.%`: the `%` is
        // immediately followed by an interpolation, i.e. raw input. Pre-wrapped
        // values (`.ilike.${like}` where like came from escapeForOr) end the
        // quasi at `.ilike.` and are not matched.
        {
          selector: "TemplateElement[value.raw=/\\.ilike\\.%$/]",
          message:
            "Raw term interpolated into an ilike or-filter — a term with , % ( ) | breaks or rewrites the filter. Use ilikeOrFilter(columns, term) from @/lib/search (or escapeForOr) instead of interpolating input directly.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
