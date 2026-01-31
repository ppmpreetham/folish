import { memo, useMemo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { getViewportBounds } from "../../utils/bounds"
import { SpatialIndexStats } from "../Debug/SpatialIndexStats"
import { decodePoints } from "../../utils/b64"

export const Renderer = memo(() => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const strokes = useCanvasStore((state) => state.doc.strokes)
  const camera = useCanvasStore((state) => state.ui.camera)
  const queryVisibleStrokes = useCanvasStore((state) => state.queryVisibleStrokes)

  const viewport = useMemo(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    return getViewportBounds(camera, { width, height })
  }, [camera.x, camera.y, camera.zoom])

  const visibleStrokesMap = useMemo(() => {
    return queryVisibleStrokes(viewport)
  }, [viewport, queryVisibleStrokes, strokes])

  return (
    <>
      <SpatialIndexStats />
      {layers.map((layer) => {
        if (!layer.visible) return null

        const layerVisibleIds = visibleStrokesMap[layer.id] || []
        if (layerVisibleIds.length === 0) return null

        return (
          <g key={layer.id} style={{ opacity: layer.opacity }}>
            {layerVisibleIds.map((strokeId) => {
              const stroke = strokes[strokeId]
              if (!stroke) return null

              const points =
                stroke.points ||
                (stroke.pointsCompressed ? decodePoints(stroke.pointsCompressed) : [])

              return (
                <path
                  key={stroke.id}
                  d={stroke.pathData}
                  fill={stroke.color}
                  opacity={stroke.opacity}
                  strokeWidth={0}
                />
              )
            })}
          </g>
        )
      })}
    </>
  )
})
