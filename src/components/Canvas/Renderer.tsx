import { memo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { Point } from "../../types"
import { getSvgPathFromStroke } from "./InfiniteCanvas"
import { getStroke } from "perfect-freehand"

export const Renderer = memo(({ zoom }: { zoom: number }) => {
  const ui = useCanvasStore((state) => state.ui)
  const doc = useCanvasStore((state) => state.doc)
  const getStrokesByLayer = useCanvasStore((state) => state.getStrokesByLayer)

  return (
    <>
      {doc.layers.map((layer) => {
        if (!layer.visible) return null
        const strokes = getStrokesByLayer(layer.id)

        function pointsToPolyline(points: Point[]): string | undefined {
          return points.map((p) => `${p.x},${p.y}`).join(" ")
        }

        return (
          <g key={layer.id} opacity={layer.opacity}>
            {strokes.map((stroke) => {
              if (stroke.pathData) {
                return (
                  <path
                    key={stroke.id}
                    d={stroke.pathData}
                    fill={stroke.color}
                    stroke="none"
                    opacity={stroke.opacity ?? 1}
                  />
                )
              }

              const pressureAvg =
                stroke.pressure?.reduce((a, b) => a + b, 0) / stroke.pressure.length || 0.5

              const outline = getStroke(
                stroke.points.map((p) => [p.x, p.y, pressureAvg]),
                {
                  size: stroke.width * 2.5,
                  thinning: 0.65,
                  smoothing: 0.5,
                  streamline: 0.5,
                  simulatePressure: false,
                  last: true,
                }
              )

              const pathData = getSvgPathFromStroke(outline)

              return (
                <path
                  key={stroke.id}
                  d={pathData}
                  fill={stroke.color}
                  stroke="none"
                  opacity={stroke.opacity ?? 1}
                />
              )
            })}
          </g>
        )
      })}
    </>
  )
})
