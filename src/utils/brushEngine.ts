import { Point } from "../types"

export function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ""
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ["M", ...stroke[0], "Q"]
  )
  d.push("Z")
  return d.join(" ")
}

export function simplifyStroke(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points

  const sqTolerance = tolerance * tolerance
  let maxSqDist = 0
  let index = 0

  const last = points.length - 1
  const p1 = points[0]
  const p2 = points[last]

  for (let i = 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], p1, p2)
    if (sqDist > maxSqDist) {
      maxSqDist = sqDist
      index = i
    }
  }

  if (maxSqDist > sqTolerance) {
    const left = simplifyStroke(points.slice(0, index + 1), tolerance)
    const right = simplifyStroke(points.slice(index), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [p1, p2]
}

function getSqSegDist(p: Point, v: Point, w: Point) {
  let x = v.x,
    y = v.y
  let dx = w.x - x,
    dy = w.y - y

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = w.x
      y = w.y
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }

  dx = p.x - x
  dy = p.y - y
  return dx * dx + dy * dy
}
