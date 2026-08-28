import { forwardRef } from 'react'

export const PaperSurface = forwardRef(function PaperSurface(
  { as: Component = 'div', className = '', children, ...props },
  ref
) {
  return (
    <Component ref={ref} className={`qn-paper-surface ${className}`} {...props}>
      {children}
    </Component>
  )
})

export function CanvasSurface({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component className={`qn-canvas-surface ${className}`} {...props}>
      {children}
    </Component>
  )
}
