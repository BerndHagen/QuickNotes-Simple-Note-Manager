import { useId } from 'react'

/**
 * Code-native SVG flags. These do not depend on emoji fonts, OS glyph support,
 * a CDN, or an internet connection, so the same flag is visible everywhere.
 */
export default function LanguageFlag({ code, className = '' }) {
  const clipId = useId().replace(/:/g, '')
  const normalized = String(code || '').toLowerCase().split('-')[0]

  const artwork = {
    en: (
      <>
        <rect width="24" height="18" fill="#23457c" />
        <path d="M0 0l24 18M24 0L0 18" stroke="#fff" strokeWidth="4" />
        <path d="M0 0l24 18M24 0L0 18" stroke="#cf2745" strokeWidth="1.6" />
        <path d="M12 0v18M0 9h24" stroke="#fff" strokeWidth="6" />
        <path d="M12 0v18M0 9h24" stroke="#cf2745" strokeWidth="3.2" />
      </>
    ),
    de: <><rect width="24" height="6" fill="#151515" /><rect y="6" width="24" height="6" fill="#d9272e" /><rect y="12" width="24" height="6" fill="#f7c928" /></>,
    es: <><rect width="24" height="4.5" fill="#aa151b" /><rect y="4.5" width="24" height="9" fill="#f1bf00" /><rect y="13.5" width="24" height="4.5" fill="#aa151b" /><circle cx="7" cy="9" r="1.5" fill="#aa151b" /></>,
    fr: <><rect width="8" height="18" fill="#1c3f8f" /><rect x="8" width="8" height="18" fill="#fff" /><rect x="16" width="8" height="18" fill="#e03c45" /></>,
    pt: <><rect width="9.5" height="18" fill="#16784b" /><rect x="9.5" width="14.5" height="18" fill="#d72b35" /><circle cx="9.5" cy="9" r="2.6" fill="#f4c542" /><circle cx="9.5" cy="9" r="1.3" fill="#fff" /></>,
    zh: <><rect width="24" height="18" fill="#df2b34" /><path d="M5.2 3.1l.7 1.7 1.8.1-1.4 1.2.5 1.8-1.6-1-1.5 1 .4-1.8-1.4-1.2 1.9-.1z" fill="#ffde4d" /><circle cx="9.5" cy="3.2" r=".65" fill="#ffde4d" /><circle cx="11.2" cy="5.3" r=".65" fill="#ffde4d" /><circle cx="11" cy="8" r=".65" fill="#ffde4d" /></>,
    hi: <><rect width="24" height="6" fill="#f29b3b" /><rect y="6" width="24" height="6" fill="#fff" /><rect y="12" width="24" height="6" fill="#26824a" /><circle cx="12" cy="9" r="2" fill="none" stroke="#244a9b" strokeWidth=".7" /><circle cx="12" cy="9" r=".45" fill="#244a9b" /></>,
    ar: <><rect width="24" height="18" fill="#187b49" /><path d="M6 8.3h12M8 11.5h9" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" /><circle cx="12" cy="6" r="1" fill="#fff" /></>,
    ru: <><rect width="24" height="6" fill="#fff" /><rect y="6" width="24" height="6" fill="#2452a4" /><rect y="12" width="24" height="6" fill="#d93945" /></>,
  }[normalized]

  return (
    <svg
      viewBox="0 0 24 18"
      data-language-flag={normalized}
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 overflow-hidden rounded-[3px] border border-black/15 shadow-xs ${className}`}
    >
      <defs><clipPath id={clipId}><rect width="24" height="18" rx="2" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        {artwork || <><rect width="24" height="18" fill="#e5e7eb" /><text x="12" y="11" textAnchor="middle" fontSize="5" fill="#374151">{normalized.toUpperCase()}</text></>}
      </g>
    </svg>
  )
}
