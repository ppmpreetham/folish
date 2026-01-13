import { memo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"

export const Renderer = memo(() => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const strokes = useCanvasStore((state) => state.doc.strokes)

  return (
    <>
      {layers.map((layer) => {
        if (!layer.visible) return null

        return (
          <g key={layer.id} opacity={layer.opacity}>
            {layer.strokeIds.map((strokeId) => {
              const stroke = strokes[strokeId]
              if (!stroke || !stroke.pathData) return null

              return (
                <path
                  key={stroke.id}
                  d={stroke.pathData}
                  fill={stroke.color}
                  opacity={stroke.opacity}
                />
              )
            })}
          </g>
        )
      })}
    </>
  )
})
