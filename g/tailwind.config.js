export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  darkMode: 'selector',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        'surface-sunken': 'var(--surface-sunken)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        'muted-foreground-subtle': 'var(--muted-foreground-subtle)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        trust: 'var(--trust)',
        'trust-foreground': 'var(--trust-foreground)',
        'trust-subtle': 'var(--trust-subtle)',
        learning: 'var(--learning)',
        'learning-foreground': 'var(--learning-foreground)',
        'learning-subtle': 'var(--learning-subtle)',
        teaching: 'var(--teaching)',
        'teaching-foreground': 'var(--teaching-foreground)',
        'teaching-subtle': 'var(--teaching-subtle)',
        ai: 'var(--ai)',
        'ai-foreground': 'var(--ai-foreground)',
        'ai-subtle': 'var(--ai-subtle)',
        warning: 'var(--warning)',
        'warning-foreground': 'var(--warning-foreground)',
        'warning-subtle': 'var(--warning-subtle)',
        caution: 'var(--caution)',
        'caution-foreground': 'var(--caution-foreground)',
        'caution-subtle': 'var(--caution-subtle)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        'user-accent': 'var(--user-accent)',
        'user-accent-foreground': 'var(--user-accent-foreground)',
        'user-accent-subtle': 'var(--user-accent-subtle)',
        'user-accent-border': 'var(--user-accent-border)'
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '3px',
        md: '3px',
        lg: '4px',
        xl: '5px',
        '2xl': '6px',
        '3xl': '8px',
        studio: 'var(--studio-radius)',
        full: '9999px'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--studio-display-font)', 'Inter', 'sans-serif'],
        title: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        '3xs': ['9px', { lineHeight: '12px' }]
      },
      boxShadow: {
        none: 'none',
        lifted: '0 1px 3px 0 var(--shadow-tint)',
        panel: '0 2px 8px -2px var(--shadow-tint)'
      },
      transitionDuration: {
        140: '140ms'
      }
    }
  }
}
