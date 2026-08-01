const getTextControl = (element) => {
  if (typeof HTMLInputElement !== 'undefined' && element instanceof HTMLInputElement) {
    return element
  }
  if (typeof HTMLTextAreaElement !== 'undefined' && element instanceof HTMLTextAreaElement) {
    return element
  }
  return null
}
export const insertTextIntoActiveField = (text, ownerDocument = document) => {
  const control = getTextControl(ownerDocument.activeElement)
  if (!control || control.disabled || control.readOnly) return false

  const insertion = `${text} `
  const start = control.selectionStart ?? control.value.length
  const end = control.selectionEnd ?? control.value.length
  const nextValue = `${control.value.slice(0, start)}${insertion}${control.value.slice(end)}`
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  if (!valueSetter) return false

  valueSetter.call(control, nextValue)
  control.setSelectionRange(start + insertion.length, start + insertion.length)
  control.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: insertion,
  }))
  return true
}
