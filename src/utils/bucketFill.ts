import simplify from "simplify-js"
import { Bounds, Point, Stroke } from "../types"

interface BucketFillOptions {
  seed: { x: number; y: number }
  strokes: Stroke[]
  maxRadius?: number
  resolution?: number
  tolerance?: number
}

interface BucketFillResult {
  pathData: string
  points: Point[]
  bounds: Bounds
}

/**
 * Performs a fast scanline flood fill on visible strokes within a localized region,
 * extracts the perimeter contour, and returns a smooth vector polygon.
 */
export function computeBucketFill({
  seed,
  strokes,
  maxRadius = 600,
  resolution = 380,
  tolerance = 1.2,
}: BucketFillOptions): BucketFillResult | null {
  const minX = seed.x - maxRadius
  const minY = seed.y - maxRadius
  const width = maxRadius * 2
  const height = maxRadius * 2

  const canvas = document.createElement("canvas")
  canvas.width = resolution
  canvas.height = resolution
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, resolution, resolution)

  const scaleX = resolution / width
  const scaleY = resolution / height

  ctx.save()
  ctx.fillStyle = "#000000"
  ctx.strokeStyle = "#000000"

  for (const stroke of strokes) {
    if (!stroke.pathData) continue
    const offsetX = stroke.offset?.x ?? 0
    const offsetY = stroke.offset?.y ?? 0

    ctx.save()
    ctx.translate((offsetX - minX) * scaleX, (offsetY - minY) * scaleY)
    ctx.scale(scaleX, scaleY)
    try {
      const p2d = new Path2D(stroke.pathData)
      ctx.fill(p2d)
      if (stroke.width > 0) {
        ctx.lineWidth = stroke.width
        ctx.stroke(p2d)
      }
    } catch {
      // Ignore invalid paths
    }
    ctx.restore()
  }
  ctx.restore()

  const seedPx = Math.round((seed.x - minX) * scaleX)
  const seedPy = Math.round((seed.y - minY) * scaleY)

  if (seedPx < 0 || seedPx >= resolution || seedPy < 0 || seedPy >= resolution) {
    return null
  }

  const imgData = ctx.getImageData(0, 0, resolution, resolution)
  const data = imgData.data

  // If clicked directly on a stroke (dark pixel), don't fill
  const seedIdx = (seedPy * resolution + seedPx) * 4
  if (data[seedIdx] < 128) {
    return null
  }

  // Scanline Flood Fill
  const mask = new Uint8Array(resolution * resolution)
  const stack: Array<[number, number]> = [[seedPx, seedPy]]
  mask[seedPy * resolution + seedPx] = 1

  let hitEdge = false
  let minFilledX = seedPx
  let maxFilledX = seedPx
  let minFilledY = seedPy
  let maxFilledY = seedPy

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!

    if (cx <= 1 || cx >= resolution - 2 || cy <= 1 || cy >= resolution - 2) {
      hitEdge = true
    }

    if (cx < minFilledX) minFilledX = cx
    if (cx > maxFilledX) maxFilledX = cx
    if (cy < minFilledY) minFilledY = cy
    if (cy > maxFilledY) maxFilledY = cy

    // 4-way expansion
    const neighbors: Array<[number, number]> = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= resolution || ny < 0 || ny >= resolution) continue
      const nIdx = ny * resolution + nx
      if (mask[nIdx] === 0) {
        const pxIdx = nIdx * 4
        // If pixel is background (white/light), flood it
        if (data[pxIdx] > 180) {
          mask[nIdx] = 1
          stack.push([nx, ny])
        }
      }
    }
  }

  // If the flood leaked across the entire canvas edge, shape is completely open
  if (hitEdge && (maxFilledX - minFilledX > resolution * 0.95 || maxFilledY - minFilledY > resolution * 0.95)) {
    return null
  }

  // Find start pixel for boundary tracing
  let startX = -1
  let startY = -1
  for (let y = minFilledY; y <= maxFilledY; y++) {
    for (let x = minFilledX; x <= maxFilledX; x++) {
      if (mask[y * resolution + x] === 1) {
        startX = x
        startY = y
        break
      }
    }
    if (startX !== -1) break
  }

  if (startX === -1) return null

  // Moore-Neighbor Tracing
  const contour: Array<{ x: number; y: number }> = []
  let currX = startX
  let currY = startY
  let backX = startX - 1
  let backY = startY

  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [1, 0],
    [1, 1], [0, 1], [-1, 1],
    [-1, 0],
  ]

  let steps = 0
  const maxSteps = resolution * 8

  do {
    contour.push({ x: currX, y: currY })

    // Find index of backtrack vector
    const dx = backX - currX
    const dy = backY - currY
    let dirIdx = directions.findIndex(([vx, vy]) => vx === dx && vy === dy)
    if (dirIdx === -1) dirIdx = 0

    let foundNext = false
    for (let i = 0; i < 8; i++) {
      const idx = (dirIdx + 1 + i) % 8
      const [nx, ny] = [currX + directions[idx][0], currY + directions[idx][1]]
      if (nx >= 0 && nx < resolution && ny >= 0 && ny < resolution) {
        if (mask[ny * resolution + nx] === 1) {
          backX = currX + directions[(idx + 7) % 8][0]
          backY = currY + directions[(idx + 7) % 8][1]
          currX = nx
          currY = ny
          foundNext = true
          break
        }
      }
    }

    if (!foundNext) break
    steps++
  } while ((currX !== startX || currY !== startY) && steps < maxSteps)

  if (contour.length < 3) return null

  // Map contour from canvas pixels back to world space
  const worldPoints = contour.map((pt) => ({
    x: pt.x / scaleX + minX,
    y: pt.y / scaleY + minY,
  }))

  const simplified = simplify(worldPoints, tolerance, true)
  if (simplified.length < 3) return null

  const pathParts = [`M ${simplified[0].x.toFixed(2)} ${simplified[0].y.toFixed(2)}`]
  for (let i = 1; i < simplified.length; i++) {
    pathParts.push(`L ${simplified[i].x.toFixed(2)} ${simplified[i].y.toFixed(2)}`)
  }
  pathParts.push("Z")

  const xs = simplified.map((p) => p.x)
  const ys = simplified.map((p) => p.y)
  const bounds: Bounds = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }

  return {
    pathData: pathParts.join(" "),
    points: simplified.map((p) => ({ ...p, pressure: 0.5 })),
    bounds,
  }
}
