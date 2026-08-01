import { useRef } from 'react'

export const useLatestValue = (value) => {
  const ref = useRef(value)
  ref.current = value
  return ref
}
