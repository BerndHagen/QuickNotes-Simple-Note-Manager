import { forwardRef } from 'react'
import { Check } from 'lucide-react'

export function CheckboxMark({ checked, className = '' }) {
  return (
    <span
      aria-hidden="true"
      data-checked={checked ? 'true' : 'false'}
      className={`qn-checkbox-mark ${className}`}
    >
      {checked && <Check strokeWidth={2.5} />}
    </span>
  )
}

/** Shared checkbox for application forms outside the customizable document checklist. */
const Checkbox = forwardRef(function Checkbox({ className = '', checked, ...props }, ref) {
  return (
    <span className={`qn-checkbox-control ${className}`}>
      <input ref={ref} type="checkbox" checked={checked} {...props} />
      <CheckboxMark checked={checked} />
    </span>
  )
})

export default Checkbox
