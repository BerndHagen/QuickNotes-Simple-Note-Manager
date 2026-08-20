export const SHAPE_GROUPS = [
  {
    label: 'Lines',
    options: [
      { value: 'line', label: 'Line', element: 'path', attributes: { d: 'M4 50H96' } },
      { value: 'line-arrow', label: 'Arrow line', element: 'path', attributes: { d: 'M4 50H92M74 32l18 18-18 18' } },
      { value: 'line-elbow', label: 'Elbow connector', element: 'path', attributes: { d: 'M4 18h48v64h44' } },
      { value: 'line-curve', label: 'Curved connector', element: 'path', attributes: { d: 'M4 78C28 8 68 92 96 22' } },
      { value: 'line-scribble', label: 'Scribble', element: 'path', attributes: { d: 'M4 66c12-42 22 34 34-10s18 30 28-8 17 12 30-22' } },
    ],
  },
  {
    label: 'Rectangles',
    options: [
      { value: 'rectangle', label: 'Rectangle', element: 'rect', attributes: { x: 1, y: 1, width: 98, height: 98 } },
      { value: 'rounded', label: 'Rounded rectangle', element: 'rect', attributes: { x: 1, y: 1, width: 98, height: 98, rx: 10, ry: 10 } },
      { value: 'snip-one', label: 'Snip single corner rectangle', element: 'polygon', attributes: { points: '1,1 76,1 99,24 99,99 1,99' } },
      { value: 'snip-two', label: 'Snip same-side corners rectangle', element: 'polygon', attributes: { points: '1,1 76,1 99,24 99,76 76,99 1,99' } },
      { value: 'round-same-side', label: 'Round same-side corners rectangle', element: 'path', attributes: { d: 'M1 1h75a23 23 0 0 1 23 23v52a23 23 0 0 1-23 23H1Z' } },
    ],
  },
  {
    label: 'Basic shapes',
    options: [
      { value: 'ellipse', label: 'Ellipse', element: 'ellipse', attributes: { cx: 50, cy: 50, rx: 49, ry: 49 } },
      { value: 'triangle', label: 'Triangle', element: 'polygon', attributes: { points: '50,1 99,99 1,99' } },
      { value: 'right-triangle', label: 'Right triangle', element: 'polygon', attributes: { points: '1,1 99,99 1,99' } },
      { value: 'diamond', label: 'Diamond', element: 'polygon', attributes: { points: '50,1 99,50 50,99 1,50' } },
      { value: 'parallelogram', label: 'Parallelogram', element: 'polygon', attributes: { points: '24,1 99,1 76,99 1,99' } },
      { value: 'trapezoid', label: 'Trapezoid', element: 'polygon', attributes: { points: '24,1 76,1 99,99 1,99' } },
      { value: 'hexagon', label: 'Hexagon', element: 'polygon', attributes: { points: '25,1 75,1 99,50 75,99 25,99 1,50' } },
      { value: 'octagon', label: 'Octagon', element: 'polygon', attributes: { points: '29,1 71,1 99,29 99,71 71,99 29,99 1,71 1,29' } },
      { value: 'cross', label: 'Cross', element: 'polygon', attributes: { points: '35,1 65,1 65,35 99,35 99,65 65,65 65,99 35,99 35,65 1,65 1,35 35,35' } },
      { value: 'heart', label: 'Heart', element: 'path', attributes: { d: 'M50 94 9 54C-11 33 3 3 27 4c10 0 19 6 23 15C55 10 64 4 74 4c24-1 38 29 17 50Z' } },
      { value: 'cloud', label: 'Cloud', element: 'path', attributes: { d: 'M23 82C8 82 1 72 1 59c0-12 8-21 20-23C25 16 43 7 59 17c14-8 32 1 34 17 13 4 11 21 3 27 2 13-7 21-21 21Z' } },
    ],
  },
  {
    label: 'Block arrows',
    options: [
      { value: 'arrow-right', label: 'Right arrow', element: 'polygon', attributes: { points: '1,24 66,24 66,1 99,50 66,99 66,76 1,76' } },
      { value: 'arrow-left', label: 'Left arrow', element: 'polygon', attributes: { points: '99,24 34,24 34,1 1,50 34,99 34,76 99,76' } },
      { value: 'arrow-up', label: 'Up arrow', element: 'polygon', attributes: { points: '24,99 24,34 1,34 50,1 99,34 76,34 76,99' } },
      { value: 'arrow-down', label: 'Down arrow', element: 'polygon', attributes: { points: '24,1 76,1 76,66 99,66 50,99 1,66 24,66' } },
      { value: 'arrow-left-right', label: 'Left-right arrow', element: 'polygon', attributes: { points: '1,50 28,18 28,35 72,35 72,18 99,50 72,82 72,65 28,65 28,82' } },
      { value: 'chevron-right', label: 'Right chevron', element: 'polygon', attributes: { points: '1,1 51,1 99,50 51,99 1,99 49,50' } },
      { value: 'chevron-left', label: 'Left chevron', element: 'polygon', attributes: { points: '99,1 49,1 1,50 49,99 99,99 51,50' } },
      { value: 'arrow-bent', label: 'Bent arrow', element: 'polygon', attributes: { points: '1,25 62,25 62,1 99,39 62,77 62,53 29,53 29,99 1,99' } },
    ],
  },
  {
    label: 'Equation shapes',
    options: [
      { value: 'math-plus', label: 'Plus', element: 'polygon', attributes: { points: '38,5 62,5 62,38 95,38 95,62 62,62 62,95 38,95 38,62 5,62 5,38 38,38' } },
      { value: 'math-minus', label: 'Minus', element: 'rect', attributes: { x: 5, y: 38, width: 90, height: 24 } },
      { value: 'math-multiply', label: 'Multiply', element: 'polygon', attributes: { points: '18,5 50,37 82,5 95,18 63,50 95,82 82,95 50,63 18,95 5,82 37,50 5,18' } },
      { value: 'math-equal', label: 'Equal', element: 'path', attributes: { d: 'M5 34h90v18H5Zm0 32h90v18H5Z' } },
    ],
  },
  {
    label: 'Flowchart',
    options: [
      { value: 'flow-process', label: 'Process', element: 'rect', attributes: { x: 1, y: 10, width: 98, height: 80 } },
      { value: 'flow-decision', label: 'Decision', element: 'polygon', attributes: { points: '50,1 99,50 50,99 1,50' } },
      { value: 'flow-terminator', label: 'Terminator', element: 'rect', attributes: { x: 1, y: 15, width: 98, height: 70, rx: 35, ry: 35 } },
      { value: 'flow-data', label: 'Data', element: 'polygon', attributes: { points: '20,10 99,10 80,90 1,90' } },
      { value: 'flow-document', label: 'Document', element: 'path', attributes: { d: 'M1 8h98v68c-25 24-50-18-98 14Z' } },
      { value: 'flow-database', label: 'Database', element: 'path', attributes: { d: 'M1 17C1-5 99-5 99 17v66c0 22-98 22-98 0Zm0 0c0 22 98 22 98 0M1 50c0 22 98 22 98 0' } },
    ],
  },
  {
    label: 'Stars and banners',
    options: [
      { value: 'star', label: 'Star', element: 'polygon', attributes: { points: '50,2 61,36 97,36 68,57 79,92 50,71 21,92 32,57 3,36 39,36' } },
      { value: 'star-eight', label: 'Eight-point star', element: 'polygon', attributes: { points: '50,1 61,27 85,15 73,39 99,50 73,61 85,85 61,73 50,99 39,73 15,85 27,61 1,50 27,39 15,15 39,27' } },
      { value: 'burst', label: 'Explosion', element: 'polygon', attributes: { points: '50,1 61,22 82,8 78,32 99,35 82,51 98,68 74,70 76,95 55,81 43,99 35,76 11,86 20,63 1,51 24,43 10,22 35,28' } },
      { value: 'ribbon', label: 'Ribbon', element: 'polygon', attributes: { points: '1,18 29,18 29,8 71,8 71,18 99,18 85,50 99,82 65,82 65,92 35,92 35,82 1,82 15,50' } },
    ],
  },
  {
    label: 'Callouts',
    options: [
      { value: 'callout', label: 'Speech callout', element: 'path', attributes: { d: 'M10 2h80a8 8 0 0 1 8 8v62a8 8 0 0 1-8 8H45L22 98l5-18H10a8 8 0 0 1-8-8V10a8 8 0 0 1 8-8Z' } },
      { value: 'rounded-callout', label: 'Rounded callout', element: 'path', attributes: { d: 'M15 3h70a12 12 0 0 1 12 12v54a12 12 0 0 1-12 12H48L25 97l6-16H15A12 12 0 0 1 3 69V15A12 12 0 0 1 15 3Z' } },
      { value: 'thought-callout', label: 'Thought callout', element: 'path', attributes: { d: 'M14 75C-5 65 1 42 17 37 11 16 35 4 50 17 67 2 91 15 86 34c18 6 16 31 1 38-7 16-31 18-43 8-11 9-24 5-30-5Zm16 16a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z' } },
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
      data-shape-type={shape.value}
      className={`qn-shape__geometry ${className}`}
    >
      <Geometry {...shape.attributes} className="qn-shape__geometry-path" />
    </svg>
  )
}
