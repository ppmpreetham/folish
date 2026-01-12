import { memo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"

export const Renderer = memo(({ zoom }: { zoom: number }) => {
  const doc = useCanvasStore((state) => state.doc)
  const getStrokesByLayer = useCanvasStore((state) => state.getStrokesByLayer)

  return (
    <>
      {doc.layers.map((layer) => {
        if (!layer.visible) return null
        const strokes = getStrokesByLayer(layer.id)

        return (
          <g key={layer.id} opacity={layer.opacity}>
            {strokes.map((stroke) => (
              <polyline
                key={stroke.id}
                points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
                strokeWidth={(stroke.width * (stroke.pressure[0] || 1)) / zoom}
                fill="none"
                stroke={stroke.color}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        )
      })}
    </>
  )
})
