import { Point, Bounds } from "../types"

export function calculateStrokeBounds(points: Point[]): Bounds {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  }
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.x > b.x + b.width ||
    a.x + a.width < b.x ||
    a.y > b.y + b.height ||
    a.y + a.height < b.y
  )
}

export function mergeBounds(a: Bounds, b: Bounds): Bounds {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function getViewportBounds(
  camera: {
    x: number
    y: number
    zoom: number
    rotation?: number
  },
  viewport: { width: number; height: number }
): Bounds {
  const radians = (-((camera.rotation ?? 0) * Math.PI)) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const centerX = viewport.width / 2
  const centerY = viewport.height / 2
  const corners = [
    { x: 0, y: 0 },
    { x: viewport.width, y: 0 },
    { x: viewport.width, y: viewport.height },
    { x: 0, y: viewport.height },
  ].map((corner) => {
    const x = corner.x - centerX
    const y = corner.y - centerY
    return {
      x: (x * cosine - y * sine + centerX - camera.x) / camera.zoom,
      y: (x * sine + y * cosine + centerY - camera.y) / camera.zoom,
    }
  })
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}
