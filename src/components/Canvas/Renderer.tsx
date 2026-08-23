import { memo, useMemo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { getViewportBounds } from "../../utils/bounds"

export const Renderer = memo(() => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const strokes = useCanvasStore((state) => state.doc.strokes)
  const texts = useCanvasStore((state) => state.doc.texts)
  const camera = useCanvasStore((state) => state.ui.camera)
  const selectedStrokeIds = useCanvasStore((state) => state.ui.selectedStrokeIds)
  const selectionTranslation = useCanvasStore((state) => state.ui.selectionTranslation)
  const nudgePreview = useCanvasStore((state) => state.ui.nudgePreview)
  const queryVisibleStrokes = useCanvasStore((state) => state.queryVisibleStrokes)

  const viewport = useMemo(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    return getViewportBounds(camera, { width, height })
  }, [camera.x, camera.y, camera.zoom, camera.rotation])

  const visibleStrokesMap = useMemo(() => {
    return queryVisibleStrokes(viewport)
  }, [viewport, queryVisibleStrokes, strokes, texts])

  const selectedStrokeIdSet = useMemo(() => new Set(selectedStrokeIds), [selectedStrokeIds])

  return (
    <>
      {layers.map((layer) => {
        if (!layer.visible) return null

        const layerVisibleIds = visibleStrokesMap[layer.id] || []
        if (layerVisibleIds.length === 0) return null
        
        const visibleSet = new Set(layerVisibleIds)

        return (
          <g key={layer.id} style={{ opacity: layer.opacity }}>
            {layer.strokeIds.filter((id) => visibleSet.has(id)).map((strokeId) => {
              const stroke = strokes[strokeId]
              if (!stroke) return null

              const isMoving = selectedStrokeIdSet.has(stroke.id)
              const x = (stroke.offset?.x ?? 0) + (isMoving ? selectionTranslation.x : 0)
              const y = (stroke.offset?.y ?? 0) + (isMoving ? selectionTranslation.y : 0)
              const pathData = nudgePreview?.strokeId === stroke.id ? nudgePreview.pathData : stroke.pathData

              return (
                <path
                  key={stroke.id}
                  d={pathData}
                  fill={stroke.color}
                  opacity={stroke.opacity}
                  strokeWidth={0}
                  transform={x || y ? `translate(${x} ${y})` : undefined}
                />
              )
            })}
            {(layer.textIds ?? []).filter((id) => visibleSet.has(id)).map((textId) => {
              const text = texts[textId]
              if (!text) return null
              const isMoving = selectedStrokeIdSet.has(text.id)
              const x = (text.offset?.x ?? 0) + (isMoving ? selectionTranslation.x : 0)
              const y = (text.offset?.y ?? 0) + (isMoving ? selectionTranslation.y : 0)
              return (
                <text
                  key={text.id}
                  x={text.x}
                  y={text.y + 16}
                  fill={text.color}
                  opacity={text.opacity}
                  fontSize={16}
                  fontFamily="inherit"
                  transform={x || y ? `translate(${x} ${y})` : undefined}
                >
                  {text.text.split("\n").map((line, index) => (
                    <tspan key={index} x={text.x} dy={index === 0 ? 0 : 20}>
                      {line || " "}
                    </tspan>
                  ))}
                </text>
              )
            })}
          </g>
        )
      })}
    </>
  )
})
