export const SHAPE_GROUPS = [
  {
    label: 'Basic shapes',
    options: [
      { value: 'rectangle', label: 'Rectangle', element: 'rect', attributes: { x: 1, y: 1, width: 98, height: 98 } },
      { value: 'rounded', label: 'Rounded rectangle', element: 'rect', attributes: { x: 1, y: 1, width: 98, height: 98, rx: 10, ry: 10 } },
      { value: 'ellipse', label: 'Ellipse', element: 'ellipse', attributes: { cx: 50, cy: 50, rx: 49, ry: 49 } },
      { value: 'triangle', label: 'Triangle', element: 'polygon', attributes: { points: '50,1 99,99 1,99' } },
      { value: 'diamond', label: 'Diamond', element: 'polygon', attributes: { points: '50,1 99,50 50,99 1,50' } },
      { value: 'hexagon', label: 'Hexagon', element: 'polygon', attributes: { points: '25,1 75,1 99,50 75,99 25,99 1,50' } },
    ],
  },
  {
    label: 'Arrows and callouts',
    options: [
      { value: 'arrow-right', label: 'Right arrow', element: 'polygon', attributes: { points: '1,24 66,24 66,1 99,50 66,99 66,76 1,76' } },
      { value: 'arrow-left', label: 'Left arrow', element: 'polygon', attributes: { points: '99,24 34,24 34,1 1,50 34,99 34,76 99,76' } },
      { value: 'arrow-up', label: 'Up arrow', element: 'polygon', attributes: { points: '24,99 24,34 1,34 50,1 99,34 76,34 76,99' } },
      { value: 'arrow-down', label: 'Down arrow', element: 'polygon', attributes: { points: '24,1 76,1 76,66 99,66 50,99 1,66 24,66' } },
      { value: 'star', label: 'Star', element: 'polygon', attributes: { points: '50,2 61,36 97,36 68,57 79,92 50,71 21,92 32,57 3,36 39,36' } },
      { value: 'callout', label: 'Speech callout', element: 'path', attributes: { d: 'M10 2h80a8 8 0 0 1 8 8v62a8 8 0 0 1-8 8H45L22 98l5-18H10a8 8 0 0 1-8-8V10a8 8 0 0 1 8-8Z' } },
    ],
  },
]

export const SHAPE_OPTIONS = SHAPE_GROUPS.flatMap((group) => group.options)

export function getShapeOption(shapeType) {
  const normalizedType = shapeType === 'arrow' ? 'arrow-right' : shapeType
  return SHAPE_OPTIONS.find((shape) => shape.value === normalizedType) || SHAPE_OPTIONS[1]
}

export function getShapeDomSpec(shapeType) {
  const shape = getShapeOption(shapeType)
  return [shape.element, { ...shape.attributes, class: 'qn-shape__geometry-path' }]
}

export default function ShapeGeometry({ shapeType, className = '' }) {
  const shape = getShapeOption(shapeType)
  const Geometry = shape.element

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`qn-shape__geometry ${className}`}
    >
      <Geometry {...shape.attributes} className="qn-shape__geometry-path" />
    </svg>
  )
}
