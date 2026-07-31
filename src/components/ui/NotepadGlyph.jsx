/**
 * The QuickNotes mark: a ruled notepad with a spiral binding and a curled
 * corner. Kept in sync with the application icon in `public/icons`, so the
 * brand reads the same in the tab, the installed app, and inside the UI.
 *
 * Drawn as filled shapes rather than strokes so it stays legible at the 14px
 * sizes used in the sidebar and the sign-in preview.
 */
export default function NotepadGlyph({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...props}>
      {/* Binding rings */}
      <g fill="currentColor" opacity="0.75">
        <rect x="6.6" y="1.4" width="1.5" height="3.6" rx="0.75" />
        <rect x="11.25" y="1.4" width="1.5" height="3.6" rx="0.75" />
        <rect x="15.9" y="1.4" width="1.5" height="3.6" rx="0.75" />
      </g>
      {/* Page with a folded bottom-right corner */}
      <path
        fill="currentColor"
        d="M5.1 4.1h13.8a1.4 1.4 0 0 1 1.4 1.4v10.2l-4.6 4.6H5.1a1.4 1.4 0 0 1-1.4-1.4V5.5a1.4 1.4 0 0 1 1.4-1.4Z"
      />
      <path fill="currentColor" opacity="0.55" d="M20.3 15.7 15.7 20.3v-3.2a1.4 1.4 0 0 1 1.4-1.4Z" />
      {/* Ruled lines. A muted teal rather than the page colour, so the mark
          survives being placed on tiles of different greens. */}
      <g stroke="#8fb6a9" strokeWidth="1.3" strokeLinecap="round">
        <line x1="6.9" y1="8.6" x2="17.1" y2="8.6" />
        <line x1="6.9" y1="11.6" x2="17.1" y2="11.6" />
        <line x1="6.9" y1="14.6" x2="13.6" y2="14.6" />
      </g>
    </svg>
  )
}
