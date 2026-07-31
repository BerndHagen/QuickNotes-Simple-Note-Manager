/** @type {import('tailwindcss').Config} */

/* Every value below resolves to a CSS custom property declared in
   src/styles/tokens.css, so light/dark theming happens in one place
   and utilities stay semantic (bg-surface, text-muted, border-subtle). */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand ramp — kept for gradients and chart-like accents.
        primary: {
          50: 'var(--qn-brand-50)',
          100: 'var(--qn-brand-100)',
          200: 'var(--qn-brand-200)',
          300: 'var(--qn-brand-300)',
          400: 'var(--qn-brand-400)',
          500: 'var(--qn-brand-500)',
          600: 'var(--qn-brand-600)',
          700: 'var(--qn-brand-700)',
          800: 'var(--qn-brand-800)',
          900: 'var(--qn-brand-900)',
          950: 'var(--qn-brand-950)',
        },

        // Semantic surfaces
        app: 'var(--qn-surface-app)',
        panel: 'var(--qn-surface-panel)',
        surface: {
          DEFAULT: 'var(--qn-surface-base)',
          raised: 'var(--qn-surface-raised)',
          sunken: 'var(--qn-surface-sunken)',
          hover: 'var(--qn-surface-hover)',
          active: 'var(--qn-surface-active)',
        },

        // Semantic text
        content: {
          DEFAULT: 'var(--qn-text)',
          muted: 'var(--qn-text-muted)',
          subtle: 'var(--qn-text-subtle)',
          inverted: 'var(--qn-text-inverted)',
        },

        accent: {
          DEFAULT: 'var(--qn-accent)',
          hover: 'var(--qn-accent-hover)',
          active: 'var(--qn-accent-active)',
          text: 'var(--qn-accent-text)',
          soft: 'var(--qn-accent-soft)',
          'soft-hover': 'var(--qn-accent-soft-hover)',
          border: 'var(--qn-accent-border)',
          on: 'var(--qn-text-on-brand)',
        },

        // Dark navigation rail (theme-independent)
        nav: {
          DEFAULT: 'var(--qn-nav-bg)',
          raised: 'var(--qn-nav-bg-raised)',
          border: 'var(--qn-nav-border)',
          text: 'var(--qn-nav-text)',
          muted: 'var(--qn-nav-text-muted)',
          subtle: 'var(--qn-nav-text-subtle)',
          hover: 'var(--qn-nav-hover)',
          active: 'var(--qn-nav-active-bg)',
          'active-text': 'var(--qn-nav-active-text)',
        },

        banner: {
          DEFAULT: 'var(--qn-banner)',
          accent: 'var(--qn-banner-accent)',
          text: 'var(--qn-banner-text)',
          muted: 'var(--qn-banner-text-muted)',
          border: 'var(--qn-banner-border)',
          hover: 'var(--qn-banner-hover)',
        },

        danger: {
          DEFAULT: 'var(--qn-danger)',
          text: 'var(--qn-danger-text)',
          soft: 'var(--qn-danger-soft)',
          border: 'var(--qn-danger-border)',
        },
        warning: {
          DEFAULT: 'var(--qn-warning)',
          text: 'var(--qn-warning-text)',
          soft: 'var(--qn-warning-soft)',
          border: 'var(--qn-warning-border)',
        },
        success: {
          DEFAULT: 'var(--qn-success)',
          text: 'var(--qn-success-text)',
          soft: 'var(--qn-success-soft)',
          border: 'var(--qn-success-border)',
        },
        info: {
          DEFAULT: 'var(--qn-info)',
          text: 'var(--qn-info-text)',
          soft: 'var(--qn-info-soft)',
          border: 'var(--qn-info-border)',
        },
      },

      borderColor: {
        DEFAULT: 'var(--qn-border)',
        subtle: 'var(--qn-border-subtle)',
        strong: 'var(--qn-border-strong)',
        control: 'var(--qn-border-control)',
      },

      borderRadius: {
        control: 'var(--qn-radius-control)',
        card: 'var(--qn-radius-card)',
        dialog: 'var(--qn-radius-dialog)',
      },

      boxShadow: {
        xs: 'var(--qn-shadow-xs)',
        sm: 'var(--qn-shadow-sm)',
        md: 'var(--qn-shadow-md)',
        lg: 'var(--qn-shadow-lg)',
        dialog: 'var(--qn-shadow-dialog)',
      },

      spacing: {
        'control-xs': 'var(--qn-control-xs)',
        'control-sm': 'var(--qn-control-sm)',
        'control-md': 'var(--qn-control-md)',
        'control-lg': 'var(--qn-control-lg)',
        touch: 'var(--qn-touch-target)',
        sidebar: 'var(--qn-sidebar-width)',
        list: 'var(--qn-list-width)',
      },

      maxWidth: {
        measure: 'var(--qn-measure)',
        'measure-wide': 'var(--qn-measure-wide)',
      },

      fontSize: {
        // Semantic UI type scale. Tailwind's own `text-sm`/`text-lg` keys
        // are deliberately left untouched — overriding them would restyle
        // every component that uses them. Use these `ui-*` / `title-*`
        // keys for app surfaces instead.
        'ui-2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.05em' }],
        'ui-xs': ['11px', { lineHeight: '16px' }],
        'ui-sm': ['12px', { lineHeight: '18px' }],
        'ui-md': ['13px', { lineHeight: '20px' }],
        'ui-lg': ['14px', { lineHeight: '21px' }],
        'title-xs': ['14px', { lineHeight: '20px', letterSpacing: '-0.006em' }],
        'title-sm': ['16px', { lineHeight: '23px', letterSpacing: '-0.01em' }],
        'title-md': ['18px', { lineHeight: '26px', letterSpacing: '-0.012em' }],
        'title-lg': ['22px', { lineHeight: '30px', letterSpacing: '-0.016em' }],
        'title-xl': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
      },

      transitionTimingFunction: {
        qn: 'var(--qn-ease)',
        'qn-out': 'var(--qn-ease-out)',
      },

      transitionDuration: {
        instant: 'var(--qn-duration-instant)',
        fast: 'var(--qn-duration-fast)',
        base: 'var(--qn-duration-base)',
        slow: 'var(--qn-duration-slow)',
      },

      zIndex: {
        sticky: 'var(--qn-z-sticky)',
        drawer: 'var(--qn-z-drawer)',
        dropdown: 'var(--qn-z-dropdown)',
        dialog: 'var(--qn-z-dialog)',
        popover: 'var(--qn-z-popover)',
        toast: 'var(--qn-z-toast)',
      },

      keyframes: {
        'qn-dialog-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'qn-sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'qn-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'qn-menu-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },

      animation: {
        'dialog-in': 'qn-dialog-in var(--qn-duration-base) var(--qn-ease-out)',
        'sheet-in': 'qn-sheet-in var(--qn-duration-base) var(--qn-ease-out)',
        'fade-in': 'qn-fade-in var(--qn-duration-fast) var(--qn-ease)',
        'menu-in': 'qn-menu-in var(--qn-duration-fast) var(--qn-ease-out)',
      },
    },
  },
  plugins: [],
}
