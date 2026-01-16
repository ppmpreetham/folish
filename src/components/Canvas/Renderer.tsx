import { memo, useMemo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { boundsIntersect, getViewportBounds } from "../../utils/bounds"

export const Renderer = memo(() => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const strokes = useCanvasStore((state) => state.doc.strokes)
  const camera = useCanvasStore((state) => state.ui.camera)

  const viewportBounds = useMemo(() => {
    return getViewportBounds(camera, { width: 10000, height: 10000 })
  }, [camera.x, camera.y, camera.zoom])

  return (
    <>
      {layers.map((layer) => {
        if (!layer.visible) return null

        if (layer.bounds && !boundsIntersect(layer.bounds, viewportBounds)) {
          return null
        }

        return (
          <g key={layer.id} style={{ opacity: layer.opacity }}>
            {layer.strokeIds.map((strokeId) => {
              const stroke = strokes[strokeId]
              if (!stroke || !stroke.pathData) return null

              if (stroke.bounds && !boundsIntersect(stroke.bounds, viewportBounds)) {
                return null
              }

              return <path key={stroke.id} d={stroke.pathData} fill={stroke.color} />
            })}
          </g>
        )
      })}
    </>
  )
})
