-- Stage 16 — Theme catalog: built-in themes that users can apply to pages.
-- Each theme stores CSS custom property overrides as a flat JSONB object.
-- The page renderer applies them directly as --var: value on the container,
-- overriding the base styles.css tokens.

-- Built-in themes (usable but not owned by any user).
INSERT INTO public.themes (id, name, description, tokens, created_by)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    'Minimal',
    'Clean, neutral workspace. High contrast text on a bright surface.',
    '{
      "colors": {"background": "#ffffff", "foreground": "#111111", "surface": "#f5f5f5", "surface-elevated": "#ffffff", "muted": "#e5e5e5", "border": "#e0e0e0", "card": "#fafafa"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "2px", "md": "4px", "lg": "6px", "xl": "8px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    'Developer',
    'Dark, code-friendly theme with a monospace feel and muted accents.',
    '{
      "colors": {"background": "#1a1a2e", "foreground": "#e0e0e0", "surface": "#16213e", "surface-elevated": "#1a1a2e", "muted": "#0f3460", "border": "#2a2a4a", "card": "#16213e", "primary": "#00d4aa", "primary-foreground": "#1a1a2e"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "2px", "md": "3px", "lg": "4px", "xl": "4px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'Terminal',
    'Green monochrome on black. Literal terminal aesthetic.',
    '{
      "colors": {"background": "#0a0a0a", "foreground": "#33ff33", "surface": "#111111", "surface-elevated": "#0a0a0a", "muted": "#1a1a1a", "border": "#33ff33", "card": "#111111", "primary": "#33ff33", "primary-foreground": "#0a0a0a", "trust": "#33ff33"},
      "typography": {"headingFont": "JetBrains Mono, ui-monospace", "bodyFont": "JetBrains Mono, ui-monospace", "monoFont": "JetBrains Mono, ui-monospace"},
      "spacing": {},
      "borders": {"radius": {"sm": "1px", "md": "2px", "lg": "2px", "xl": "3px"}, "style": "1px solid var(--border)"},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    'Paper',
    'Warm off-white with serif headings. Feels like a printed page.',
    '{
      "colors": {"background": "#fefcf5", "foreground": "#2c2416", "surface": "#f8f4e8", "surface-elevated": "#fefcf5", "muted": "#ede4cf", "border": "#d4c9a8", "card": "#faf6ec"},
      "typography": {"headingFont": "Georgia, \"Times New Roman\", serif", "bodyFont": "Georgia, \"Times New Roman\", serif"},
      "spacing": {},
      "borders": {"radius": {"sm": "2px", "md": "3px", "lg": "4px", "xl": "6px"}},
      "shadows": {"soft": "0 1px 3px rgba(0,0,0,0.06)"}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    'Brutalist',
    'Raw, uncompromising. Heavy borders, no rounding, stark black-white-red.',
    '{
      "colors": {"background": "#ffffff", "foreground": "#000000", "surface": "#ffffff", "surface-elevated": "#ffffff", "muted": "#f0f0f0", "border": "#000000", "card": "#ffffff", "primary": "#ff0000", "primary-foreground": "#ffffff", "trust": "#000000", "card-foreground": "#000000"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "0px", "md": "0px", "lg": "0px", "xl": "0px"}, "style": "2px solid var(--border)"},
      "shadows": {"hard": "4px 4px 0px #000"}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000015',
    'Glass',
    'Translucent surfaces with subtle blur. Light and airy.',
    '{
      "colors": {"background": "#f0f4f8", "foreground": "#1a202c", "surface": "rgba(255,255,255,0.6)", "surface-elevated": "rgba(255,255,255,0.8)", "muted": "rgba(200,210,220,0.4)", "border": "rgba(180,190,200,0.3)", "card": "rgba(255,255,255,0.6)"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "6px", "md": "8px", "lg": "12px", "xl": "16px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000016',
    'Retro',
    'Warm, saturated 90s web palette. Nostalgic and playful.',
    '{
      "colors": {"background": "#fff8e7", "foreground": "#2d1b00", "surface": "#ffe8c8", "surface-elevated": "#fff8e7", "muted": "#ffd699", "border": "#cc8800", "card": "#ffe8c8", "primary": "#cc4400", "primary-foreground": "#fff8e7", "trust": "#006600"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "4px", "md": "6px", "lg": "8px", "xl": "10px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000017',
    'Cyberpunk',
    'Neon on dark. High contrast, electric accents, sharp edges.',
    '{
      "colors": {"background": "#0d0221", "foreground": "#f0e6ff", "surface": "#15052e", "surface-elevated": "#0d0221", "muted": "#1a0535", "border": "#ff00ff", "card": "#15052e", "primary": "#00ffff", "primary-foreground": "#0d0221", "trust": "#00ffff"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "2px", "md": "3px", "lg": "4px", "xl": "4px"}},
      "shadows": {"neon": "0 0 8px rgba(255,0,255,0.4)"}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000018',
    'Academic',
    'Scholarly, dignified. Cream background, navy accents, classic serif.',
    '{
      "colors": {"background": "#fcfaf6", "foreground": "#1a1a2e", "surface": "#f5f0e8", "surface-elevated": "#fcfaf6", "muted": "#e8e0d0", "border": "#c4b998", "card": "#f7f2ea", "primary": "#1e3a5f", "primary-foreground": "#fcfaf6"},
      "typography": {"headingFont": "\"Palatino Linotype\", \"Book Antiqua\", Palatino, serif", "bodyFont": "\"Palatino Linotype\", Georgia, serif"},
      "spacing": {},
      "borders": {"radius": {"sm": "3px", "md": "4px", "lg": "5px", "xl": "6px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000019',
    'Nature',
    'Earthy greens and warm browns on an organic background.',
    '{
      "colors": {"background": "#f5f9f4", "foreground": "#1c2a1a", "surface": "#eaf4e6", "surface-elevated": "#f5f9f4", "muted": "#d4e8cc", "border": "#a3c19a", "card": "#eef6ea", "primary": "#4a7c3f", "primary-foreground": "#f5f9f4", "trust": "#4a7c3f"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "4px", "md": "6px", "lg": "8px", "xl": "12px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000020',
    'Studio',
    'Creative workspace. Vibrant magenta accent on clean dark surfaces.',
    '{
      "colors": {"background": "#1e1e2e", "foreground": "#e6e6f0", "surface": "#282840", "surface-elevated": "#1e1e2e", "muted": "#313150", "border": "#3a3a5c", "card": "#282840", "primary": "#ff6b9d", "primary-foreground": "#1e1e2e", "trust": "#ff6b9d"},
      "typography": {"headingFont": "\"Space Grotesk\", Inter, sans-serif"},
      "spacing": {},
      "borders": {"radius": {"sm": "4px", "md": "6px", "lg": "10px", "xl": "14px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000021',
    'Sunset',
    'Warm gradient undertones with golden hour amber accents.',
    '{
      "colors": {"background": "#fff5f0", "foreground": "#3d200e", "surface": "#ffede3", "surface-elevated": "#fff5f0", "muted": "#ffe0cc", "border": "#f0c4a8", "card": "#ffede3", "primary": "#e8652d", "primary-foreground": "#fff5f0", "trust": "#d4813a"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "4px", "md": "6px", "lg": "8px", "xl": "10px"}},
      "shadows": {}
    }'::jsonb,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    'Midnight',
    'Deep indigo with soft blue text. Quiet, focused, nocturnal.',
    '{
      "colors": {"background": "#0b0d17", "foreground": "#c8d6f0", "surface": "#12152a", "surface-elevated": "#0b0d17", "muted": "#1a1e3a", "border": "#252a4a", "card": "#12152a", "primary": "#7b9ffa", "primary-foreground": "#0b0d17"},
      "typography": {"headingFont": ""},
      "spacing": {},
      "borders": {"radius": {"sm": "4px", "md": "6px", "lg": "8px", "xl": "10px"}},
      "shadows": {}
    }'::jsonb,
    null
  )
ON CONFLICT (id) DO NOTHING;