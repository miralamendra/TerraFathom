/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          hover: 'var(--color-bg-hover)',
          active: 'var(--color-bg-active)',
          elevated: 'var(--color-bg-elevated)',
        },
        border: {
          primary: 'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          focus: 'var(--color-border-focus)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          muted: 'var(--color-accent-muted)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        
        // Linear Colors
        void: 'var(--color-void)',
        carbon: 'var(--color-carbon)',
        obsidian: 'var(--color-obsidian)',
        graphite: 'var(--color-graphite)',
        smoke: 'var(--color-smoke)',
        ash: 'var(--color-ash)',
        fog: 'var(--color-fog)',
        mist: 'var(--color-mist)',
        bone: 'var(--color-bone)',
        paper: 'var(--color-paper)',
        'acid-lime': 'var(--color-acid-lime)',
        'pulse-green': 'var(--color-pulse-green)',
        'coral-red': 'var(--color-coral-red)',
        'signal-teal': 'var(--color-signal-teal)',
        'iris-violet': 'var(--color-iris-violet)',
        'lavender': 'var(--color-lavender)',
        
        exhibit: {
          bg: '#111111',
          panel: '#171717',
          border: '#2B2B2B',
          primary: '#ECE8E1',
          secondary: '#9E9A94',
          accent: '#C8A46A',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.4' }],    // Section Label, Metadata
        sm: ['12px', { lineHeight: '1.4' }],    // Panel Title, Button Text
        base: ['13px', { lineHeight: '1.5' }],  // Body, Toolbar Title, Inputs
        lg: ['15px', { lineHeight: '1.5' }],    // Large Label
        xl: ['20px', { lineHeight: '1.5' }],    // Display Title
        '2xl': ['28px', { lineHeight: '1.5' }],  // Large Display
      },
      borderRadius: {
        control: '6px',
        float: '12px',
      },
      boxShadow: {
        'tight': '0 1px 2px rgba(0, 0, 0, 0.15)',
        'floating': '0 8px 24px rgba(0,0,0,0.4)',
        'menu': '0 8px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
