import { describe, expect, it } from 'vitest'
import { constrainRectangleToPage, selectDocumentPage } from './documentPageBounds'

const pages = [
  { index: 0, left: 0, top: 0, right: 800, bottom: 1120, width: 800, height: 1120 },
  { index: 1, left: 0, top: 1152, right: 800, bottom: 2272, width: 800, height: 1120 },
]

describe('document page bounds', () => {
  it('keeps a document object on the sheet containing its centre', () => {
    expect(selectDocumentPage(pages, { x: 120, y: 1180, width: 200, height: 80 })?.index).toBe(1)
  })

  it('assigns an object in a page gap to the nearest sheet', () => {
    expect(selectDocumentPage(pages, { x: 120, y: 1122, width: 40, height: 8 })?.index).toBe(0)
    expect(selectDocumentPage(pages, { x: 120, y: 1140, width: 40, height: 8 })?.index).toBe(1)
  })

  it('constrains position and dimensions inside all four page edges', () => {
    expect(constrainRectangleToPage(
      { x: -20, y: 1040, width: 900, height: 300 },
      pages[0],
      { inset: 8, minimumWidth: 96, minimumHeight: 56 }
    )).toEqual({ x: 8, y: 812, width: 784, height: 300 })
  })
})
