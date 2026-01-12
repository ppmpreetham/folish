import { getStroke, StrokeOptions } from "perfect-freehand"

// Unified config for the "Pen" tool
export const BRUSH_CONFIG: StrokeOptions = {
  size: 8, // Base size, will be multiplied by ui.activeWidth
  thinning: 0.65,
  smoothing: 0.55,
  streamline: 0.5,
  simulatePressure: false,
  last: true,
}

/**
 * Generates the SVG path string from raw point data [x, y, pressure]
 */
export const generateStrokePath = (points: Array<[number, number, number]>, baseWidth: number) => {
  const outline = getStroke(points, {
    ...BRUSH_CONFIG,
    size: baseWidth * 2.5, // Standardize the multiplier here
  })

  if (outline.length < 4) return ""

  const d: string[] = []
  d.push(`M${outline[0][0].toFixed(2)},${outline[0][1].toFixed(2)}`)

  for (let i = 1; i < outline.length; i++) {
    const midX = (outline[i][0] + outline[i - 1][0]) / 2
    const midY = (outline[i][1] + outline[i - 1][1]) / 2
    d.push(
      `Q${outline[i - 1][0].toFixed(2)},${outline[i - 1][1].toFixed(2)} ` +
        `${midX.toFixed(2)},${midY.toFixed(2)}`
    )
  }

  d.push("Z")
  return d.join(" ")
}
