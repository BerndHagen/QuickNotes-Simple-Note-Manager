import { useEffect, useState } from 'react'

const SIZES = {
  sm: 'h-7 w-7 text-ui-sm',
  md: 'h-8 w-8 text-ui-md',
  lg: 'h-11 w-11 text-title-xs',
  xl: 'h-16 w-16 text-title-md',
}

/**
 * User avatar with a deterministic initials fallback.
 *
 * The profile picture lives in `user_metadata.avatar_url`. A broken or
 * unreachable URL falls back to initials through `onError`, so the
 * fallback does not depend on the surrounding markup.
 */
export default function Avatar({ user, size = 'md', className = '' }) {
  const url = user?.user_metadata?.avatar_url || null
  const [failed, setFailed] = useState(false)

  // A new URL deserves a fresh attempt.
  useEffect(() => setFailed(false), [url])

  const name =
    user?.user_metadata?.first_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    ''
  const initials = name.trim().charAt(0).toUpperCase() || 'Q'
  const showImage = url && !failed

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-accent-active font-semibold text-accent-on ${
 SIZES[size] || SIZES.md
 } ${className}`}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  )
}
