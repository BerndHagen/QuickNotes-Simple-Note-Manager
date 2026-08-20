export const DEFAULT_LIGHT_PAPER = 'plain'
export const DEFAULT_DARK_PAPER = 'dark'

export const paperStyles = {
  plain: {
    name: 'Plain',
    className: 'paper-plain',
    style: {},
    preview: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb' },
  },
  lined: {
    name: 'Lined',
    className: 'paper-lined',
    style: {
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e5e7eb 31px, #e5e7eb 32px)',
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
    },
    preview: { backgroundImage: 'repeating-linear-gradient(transparent, transparent 3px, #d1d5db 3px, #d1d5db 4px)', backgroundSize: '100% 4px' },
  },
  linedMargin: {
    name: 'Lined + Margin',
    className: 'paper-lined-margin',
    style: {
      backgroundImage: `
        linear-gradient(90deg, transparent 60px, #ef4444 60px, #ef4444 62px, transparent 62px),
        repeating-linear-gradient(transparent, transparent 31px, #e5e7eb 31px, #e5e7eb 32px)
      `,
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
      paddingLeft: '70px',
    },
    preview: { backgroundImage: 'linear-gradient(90deg, transparent 4px, #ef4444 4px, #ef4444 5px, transparent 5px), repeating-linear-gradient(transparent, transparent 3px, #d1d5db 3px, #d1d5db 4px)', backgroundSize: '100% 4px' },
  },
  college: {
    name: 'College Rule',
    className: 'paper-college',
    style: {
      backgroundImage: `
        linear-gradient(90deg, transparent 40px, #3b82f6 40px, #3b82f6 42px, transparent 42px),
        repeating-linear-gradient(transparent, transparent 27px, #93c5fd 27px, #93c5fd 28px)
      `,
      backgroundSize: '100% 28px',
      backgroundAttachment: 'local',
      lineHeight: '28px',
      paddingLeft: '50px',
    },
    preview: { backgroundImage: 'linear-gradient(90deg, transparent 4px, #3b82f6 4px, #3b82f6 5px, transparent 5px), repeating-linear-gradient(transparent, transparent 3px, #93c5fd 3px, #93c5fd 4px)', backgroundSize: '100% 4px' },
  },
  grid: {
    name: 'Grid',
    className: 'paper-grid',
    style: {
      backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)', backgroundSize: '5px 5px' },
  },
  gridSmall: {
    name: 'Grid (Small)',
    className: 'paper-grid-small',
    style: {
      backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
      backgroundSize: '12px 12px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)', backgroundSize: '3px 3px' },
  },
  dotted: {
    name: 'Dotted',
    className: 'paper-dotted',
    style: {
      backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', backgroundSize: '5px 5px' },
  },
  dottedDense: {
    name: 'Dotted (Dense)',
    className: 'paper-dotted-dense',
    style: {
      backgroundImage: 'radial-gradient(circle, #d1d5db 1.5px, transparent 1.5px)',
      backgroundSize: '16px 16px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', backgroundSize: '3px 3px' },
  },
  sepia: {
    name: 'Sepia',
    className: 'paper-sepia',
    style: {
      backgroundColor: '#fef3c7',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #fde68a 31px, #fde68a 32px)',
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
    },
    preview: { backgroundColor: '#fef3c7' },
  },
  blueprint: {
    name: 'Blueprint',
    className: 'paper-blueprint',
    style: {
      backgroundColor: '#1e3a5f',
      backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundAttachment: 'local',
      color: '#e0e7ff',
    },
    preview: { backgroundColor: '#1e3a5f', backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '5px 5px' },
  },
  dark: {
    name: 'Dark',
    className: 'paper-dark',
    style: {
      backgroundColor: '#1f2937',
      color: '#e5e7eb',
    },
    preview: { backgroundColor: '#1f2937' },
  },
  darkLined: {
    name: 'Dark Lined',
    className: 'paper-dark-lined',
    style: {
      backgroundColor: '#1f2937',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #374151 31px, #374151 32px)',
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
      color: '#e5e7eb',
    },
    preview: { backgroundColor: '#1f2937', backgroundImage: 'repeating-linear-gradient(transparent, transparent 3px, #4b5563 3px, #4b5563 4px)', backgroundSize: '100% 4px' },
  },
}

export const normalizePaperType = (value, fallback = DEFAULT_LIGHT_PAPER) =>
  Object.prototype.hasOwnProperty.call(paperStyles, value) ? value : fallback

export const getNotePaperType = (note, darkMode = false) =>
  normalizePaperType(
    note?.noteData?.paperType,
    darkMode ? DEFAULT_DARK_PAPER : DEFAULT_LIGHT_PAPER
  )
