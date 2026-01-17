import { memo, useMemo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { getViewportBounds } from "../../utils/bounds"
import { SpatialIndexStats } from "../Debug/SpatialIndexStats"

export const Renderer = memo(() => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const strokes = useCanvasStore((state) => state.doc.strokes)
  const camera = useCanvasStore((state) => state.ui.camera)
  const queryVisibleStrokes = useCanvasStore((state) => state.queryVisibleStrokes)

  const viewport = useMemo(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    const vp = getViewportBounds(camera, { width, height })
    console.log("📐 Viewport:", vp)
    return vp
  }, [camera.x, camera.y, camera.zoom])

  const visibleStrokeIds = useMemo(() => {
    const ids = queryVisibleStrokes(viewport)
    console.log("👁️ Visible strokes:", ids.length, "/", Object.keys(strokes).length)
    return new Set(ids)
  }, [viewport, queryVisibleStrokes, strokes])

  console.log("🎨 Rendering", layers.length, "layers")

  return (
    <>
      <SpatialIndexStats />
      {layers.map((layer) => {
        if (!layer.visible) return null
        console.log("📄 Layer", layer.name, "- Strokes:", layer.strokeIds.length)

        return (
          <g key={layer.id} style={{ opacity: layer.opacity }}>
            {layer.strokeIds.map((strokeId) => {
              if (!visibleStrokeIds.has(strokeId)) {
                console.log("🚫 Culled:", strokeId)
                return null
              }

              const stroke = strokes[strokeId]
              if (!stroke || !stroke.pathData) {
                console.log("❌ Missing stroke data:", strokeId)
                return null
              }

              console.log("✅ Rendering:", strokeId)
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
