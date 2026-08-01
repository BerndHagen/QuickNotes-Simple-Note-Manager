import { useEffect, useRef } from 'react'
import { useLatestValue } from './useLatestValue'

const serialize = (value) => {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}
export const useEditorDataSync = (incoming, current, applyIncoming) => {
  const incomingKey = serialize(incoming)
  const incomingRef = useLatestValue(incoming)
  const currentRef = useLatestValue(current)
  const applyIncomingRef = useLatestValue(applyIncoming)
  const previousIncomingKeyRef = useRef(incomingKey)
  const skipNextEmissionRef = useRef(false)

  useEffect(() => {
    if (incomingKey === previousIncomingKeyRef.current) return
    previousIncomingKeyRef.current = incomingKey
    if (incomingKey == null || incomingKey === serialize(currentRef.current)) return

    skipNextEmissionRef.current = true
    applyIncomingRef.current(incomingRef.current)
  }, [applyIncomingRef, currentRef, incomingKey, incomingRef])

  return skipNextEmissionRef
}
