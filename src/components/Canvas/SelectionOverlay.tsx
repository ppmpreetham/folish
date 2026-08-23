import { memo, useMemo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { mergeBounds } from "../../utils/bounds"

export const SelectionOverlay = memo(() => {
  const selectedStrokeIds = useCanvasStore((state) => state.ui.selectedStrokeIds)
  const selectionLasso = useCanvasStore((state) => state.ui.selectionLasso)
  const selectionMarquee = useCanvasStore((state) => state.ui.selectionMarquee)
  const selectionTranslation = useCanvasStore((state) => state.ui.selectionTranslation)
  const strokes = useCanvasStore((state) => state.doc.strokes)
  const texts = useCanvasStore((state) => state.doc.texts)
  const camera = useCanvasStore((state) => state.ui.camera)

  const selectedBounds = useMemo(() => {
    let bounds: { x: number; y: number; width: number; height: number } | undefined
    for (const id of selectedStrokeIds) {
      const shapeBounds = strokes[id]?.bounds ?? texts[id]?.bounds
      if (!shapeBounds) continue
      bounds = bounds ? mergeBounds(bounds, shapeBounds) : shapeBounds
    }
    return bounds
  }, [selectedStrokeIds, strokes, texts])

  const strokeWidth = 1.5 / camera.zoom
  const guideWidth = 0.5 / camera.zoom
  const handleSize = 7 / camera.zoom
  const viewport = {
    x: -camera.x / camera.zoom,
    y: -camera.y / camera.zoom,
    width: window.innerWidth / camera.zoom,
    height: window.innerHeight / camera.zoom,
  }

  return (
    <g className="pointer-events-none">
      {selectionLasso && selectionLasso.points.length > 1 && (
        <path
          d={`M ${selectionLasso.points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`}
          fill="rgba(107, 114, 128, 0.08)"
          stroke="#6b7280"
          strokeWidth={strokeWidth}
          strokeDasharray={`${3 / camera.zoom} ${4 / camera.zoom}`}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {selectionMarquee && (
        <rect
          x={selectionMarquee.x}
          y={selectionMarquee.y}
          width={selectionMarquee.width}
          height={selectionMarquee.height}
          fill="rgba(107, 114, 128, 0.08)"
          stroke="#6b7280"
          strokeWidth={strokeWidth}
          strokeDasharray={`${3 / camera.zoom} ${4 / camera.zoom}`}
        />
      )}
      {selectedBounds && !selectionLasso && !selectionMarquee && (
        <>
          <g stroke="#6b7280" strokeWidth={guideWidth} opacity={0.3}>
            <line x1={selectedBounds.x + selectionTranslation.x} y1={viewport.y} x2={selectedBounds.x + selectionTranslation.x} y2={viewport.y + viewport.height} />
            <line x1={selectedBounds.x + selectedBounds.width + selectionTranslation.x} y1={viewport.y} x2={selectedBounds.x + selectedBounds.width + selectionTranslation.x} y2={viewport.y + viewport.height} />
            <line x1={viewport.x} y1={selectedBounds.y + selectionTranslation.y} x2={viewport.x + viewport.width} y2={selectedBounds.y + selectionTranslation.y} />
            <line x1={viewport.x} y1={selectedBounds.y + selectedBounds.height + selectionTranslation.y} x2={viewport.x + viewport.width} y2={selectedBounds.y + selectedBounds.height + selectionTranslation.y} />
          </g>
          <g transform={`translate(${selectionTranslation.x} ${selectionTranslation.y})`}>
          <rect
            x={selectedBounds.x}
            y={selectedBounds.y}
            width={selectedBounds.width}
            height={selectedBounds.height}
            fill="rgba(107, 114, 128, 0.04)"
            stroke="#6b7280"
            strokeWidth={strokeWidth}
          />
          {[
            [selectedBounds.x, selectedBounds.y],
            [selectedBounds.x + selectedBounds.width, selectedBounds.y],
            [selectedBounds.x + selectedBounds.width, selectedBounds.y + selectedBounds.height],
            [selectedBounds.x, selectedBounds.y + selectedBounds.height],
          ].map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={handleSize / 2}
              fill="white"
              stroke="#6b7280"
              strokeWidth={strokeWidth}
            />
          ))}
          </g>
        </>
      )}
    </g>
  )
})

SelectionOverlay.displayName = "SelectionOverlay"
