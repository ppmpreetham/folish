import type { Bounds, DashType, ShapeKind, ShapeShape, ShapeSize } from "../types"

export const SHAPE_STROKE_WIDTHS: Record<ShapeSize, number> = {
  s: 2,
  m: 3.5,
  l: 6,
  xl: 10,
}

export const SHAPE_CORNER_RADII: Record<ShapeSize, number> = {
  s: 2,
  m: 4,
  l: 8,
  xl: 14,
}

export const DEFAULT_SHAPE_WIDTH = 140
export const DEFAULT_SHAPE_HEIGHT = 140
export const DEFAULT_LINE_LENGTH = 200

/** World-space grid used by the snap-to-grid toggle (half of the 80px canvas grid). */
export const SNAP_GRID_SIZE = 40

export const snapValue = (value: number, enabled: boolean, grid = SNAP_GRID_SIZE) =>
  enabled ? Math.round(value / grid) * grid : value

export const snapPoint = (
  point: { x: number; y: number },
  enabled: boolean,
  grid = SNAP_GRID_SIZE,
) => ({ x: snapValue(point.x, enabled, grid), y: snapValue(point.y, enabled, grid) })

export const isClosedShape = (kind: ShapeKind) =>
  kind === "rect" || kind === "ellipse" || kind === "triangle" || kind === "diamond"

export const getDashArray = (dash: DashType, strokeWidth: number): string | undefined => {
  if (dash === "dashed") return `${strokeWidth * 3} ${strokeWidth * 3}`
  if (dash === "dotted") return `${strokeWidth} ${strokeWidth * 2.2}`
  return undefined
}

/** Path for the open shapes (line / arrow shaft). start/end account for flip flags. */
export const getLineEndPoints = (shape: {
  x: number
  y: number
  width: number
  height: number
  flipX?: boolean
  flipY?: boolean
}): { x1: number; y1: number; x2: number; y2: number } => {
  const x1 = shape.flipX ? shape.x + shape.width : shape.x
  const y1 = shape.flipY ? shape.y + shape.height : shape.y
  const x2 = shape.flipX ? shape.x : shape.x + shape.width
  const y2 = shape.flipY ? shape.y : shape.y + shape.height
  return { x1, y1, x2, y2 }
}

export const getTrianglePath = (x: number, y: number, width: number, height: number) =>
  `M ${x + width / 2} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`

export const getDiamondPath = (x: number, y: number, width: number, height: number) =>
  `M ${x + width / 2} ${y} L ${x + width} ${y + height / 2} L ${x + width / 2} ${y + height} L ${x} ${y + height / 2} Z`

export const getArrowHead = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number,
): string => {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const headLength = Math.max(12, strokeWidth * 4)
  const headWidth = headLength * 0.62
  const backX = x2 - Math.cos(angle) * headLength
  const backY = y2 - Math.sin(angle) * headLength
  const perpX = Math.cos(angle + Math.PI / 2) * headWidth
  const perpY = Math.sin(angle + Math.PI / 2) * headWidth
  return `M ${backX + perpX} ${backY + perpY} L ${x2} ${y2} L ${backX - perpX} ${backY - perpY} Z`
}

export const getShapeBounds = (
  x: number,
  y: number,
  width: number,
  height: number,
  strokeWidth: number,
): Bounds => ({
  x: x - strokeWidth,
  y: y - strokeWidth,
  width: width + strokeWidth * 2,
  height: height + strokeWidth * 2,
})

/** Renders a shape's SVG element(s); keeps Renderer lean. */
export const getShapeStrokeWidth = (shape: ShapeShape) => SHAPE_STROKE_WIDTHS[shape.size]

/**
 * Distance from point to the visible outline of a shape (world units).
 * Returns 0 when the point is inside a closed filled shape.
 */
export const pointHitsShape = (
  shape: Pick<ShapeShape, "kind" | "x" | "y" | "width" | "height" | "fill" | "size" | "flipX" | "flipY">,
  point: { x: number; y: number },
  zoom: number,
): boolean => {
  const { kind } = shape
  const strokeWidth = SHAPE_STROKE_WIDTHS[shape.size]
  const tolerance = Math.max(strokeWidth, 8 / zoom)

  if (kind === "line" || kind === "arrow") {
    const { x1, y1, x2, y2 } = getLineEndPoints(shape)
    return distanceToSegment(point, { x: x1, y: y1 }, { x: x2, y: y2 }) <= tolerance
  }

  const inside =
    point.x >= shape.x &&
    point.x <= shape.x + shape.width &&
    point.y >= shape.y &&
    point.y <= shape.y + shape.height

  if (shape.fill !== "none") return inside

  if (!inside) {
    const expanded = {
      x: shape.x - tolerance,
      y: shape.y - tolerance,
      width: shape.width + tolerance * 2,
      height: shape.height + tolerance * 2,
    }
    const insideExpanded =
      point.x >= expanded.x &&
      point.x <= expanded.x + expanded.width &&
      point.y >= expanded.y &&
      point.y <= expanded.y + expanded.height
    if (!insideExpanded) return false
  }

  // Outline-only hit: near an edge (or vertex) of the shape.
  if (kind === "ellipse") {
    const rx = shape.width / 2
    const ry = shape.height / 2
    if (rx === 0 || ry === 0) return true
    const dx = (point.x - shape.x - rx) / (rx + tolerance)
    const dy = (point.y - shape.y - ry) / (ry + tolerance)
    const innerDx = (point.x - shape.x - rx) / Math.max(rx - tolerance, 0.001)
    const innerDy = (point.y - shape.y - ry) / Math.max(ry - tolerance, 0.001)
    return dx * dx + dy * dy <= 1 && innerDx * innerDx + innerDy * innerDy >= 1
  }

  const edges: Array<[{ x: number; y: number }, { x: number; y: number }]> =
    kind === "triangle"
      ? [
          [{ x: shape.x + shape.width / 2, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height }],
          [{ x: shape.x + shape.width, y: shape.y + shape.height }, { x: shape.x, y: shape.y + shape.height }],
          [{ x: shape.x, y: shape.y + shape.height }, { x: shape.x + shape.width / 2, y: shape.y }],
        ]
      : [
          [{ x: shape.x + shape.width / 2, y: shape.y }, { x: shape.x + shape.width, y: shape.y + shape.height / 2 }],
          [{ x: shape.x + shape.width, y: shape.y + shape.height / 2 }, { x: shape.x + shape.width / 2, y: shape.y + shape.height }],
          [{ x: shape.x + shape.width / 2, y: shape.y + shape.height }, { x: shape.x, y: shape.y + shape.height / 2 }],
          [{ x: shape.x, y: shape.y + shape.height / 2 }, { x: shape.x + shape.width / 2, y: shape.y }],
        ]
  return edges.some(([start, end]) => distanceToSegment(point, start, end) <= tolerance)
}

export const distanceToSegment = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const abx = end.x - start.x
  const aby = end.y - start.y
  const lengthSquared = abx * abx + aby * aby
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - start.x) * abx + (point.y - start.y) * aby) / lengthSquared))
  const dx = point.x - (start.x + abx * t)
  const dy = point.y - (start.y + aby * t)
  return Math.hypot(dx, dy)
}
