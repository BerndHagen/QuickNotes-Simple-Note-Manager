import { Loader2 } from 'lucide-react'

const SIZES = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' }

export default function Spinner({ size = 'md', label = 'Loading', className = '' }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <Loader2 className={`${SIZES[size] || SIZES.md} animate-spin text-accent`} aria-hidden="true" />
      <span className="qn-sr-only">{label}</span>
    </span>
  )
}
