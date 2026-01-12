import React, { useRef, useEffect, useReducer } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { useCanvasEvents } from "../../hooks/useCanvasEvents"
import { Point, Camera } from "../../types"
import { Grid } from "./Grid"
import { Renderer } from "./Renderer"
import simplify from "simplify-js"

export const InfiniteCanvas: React.FC = () => {
  const doc = useCanvasStore((state) => state.doc)
  const ui = useCanvasStore((state) => state.ui)
  const actions = useCanvasStore()

  const containerRef = useRef<SVGSVGElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const cameraRef = useRef<Camera>(ui.camera)

  const currentPointsRef = useRef<Point[]>([])
  const currentPressureRef = useRef<number[]>([])

  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  useEffect(() => {
    cameraRef.current = ui.camera
  }, [ui.camera])

  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        rectRef.current = containerRef.current.getBoundingClientRect()
      }
    }
    updateRect()
    window.addEventListener("resize", updateRect)
    return () => window.removeEventListener("resize", updateRect)
  }, [])

  const { handlePointerDown, handlePointerMove, handlePointerUp } = useCanvasEvents({
    cameraRef,
    rectRef,
    activeTool: ui.activeTool,

    onStrokeStart: (p) => {
      currentPointsRef.current = [{ x: p.x, y: p.y }]
      currentPressureRef.current = [p.pressure]
    },

    onStrokeMove: (p) => {
      currentPointsRef.current.push({ x: p.x, y: p.y })
      currentPressureRef.current.push(p.pressure)
      forceUpdate()
    },

    onStrokeEnd: () => {
      if (currentPointsRef.current.length < 2) return

      const simplifiedPoints = simplify(currentPointsRef.current, 1.2, true)

      const pressureStep = currentPressureRef.current.length / simplifiedPoints.length
      const alignedPressure = simplifiedPoints.map((_, i) => {
        return currentPressureRef.current[Math.floor(i * pressureStep)]
      })

      actions.addStroke({
        id: crypto.randomUUID(),
        points: simplifiedPoints,
        pressure: alignedPressure,
        color: ui.activeColor,
        width: ui.activeWidth,
        opacity: ui.activeOpacity,
        tool: ui.activeTool,
        layerId: ui.activeLayerId,
        timestamp: Date.now(),
      })

      currentPointsRef.current = []
      currentPressureRef.current = []
      forceUpdate()
    },

    onPanMove: (dx, dy) => {
      actions.setCamera({
        ...cameraRef.current,
        x: cameraRef.current.x + dx,
        y: cameraRef.current.y + dy,
      })
    },

    onZoom: (newCamera) => {
      actions.setCamera(newCamera)
    },
  })

  const cursorClass = ui.activeTool === "pan" ? "cursor-grab" : "cursor-crosshair"

  return (
    <svg
      ref={containerRef}
      className={`w-full h-full bg-slate-50 overflow-hidden touch-none ${cursorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g transform={`translate(${ui.camera.x}, ${ui.camera.y}) scale(${ui.camera.zoom})`}>
        <Grid camera={ui.camera} />
        <Renderer zoom={ui.camera.zoom} />
        {currentPointsRef.current.length > 1 && (
          <polyline
            points={currentPointsRef.current.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={ui.activeColor}
            strokeWidth={(ui.activeWidth * (currentPressureRef.current[0] || 1)) / ui.camera.zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.6}
            className="pointer-events-none"
          />
        )}
      </g>
    </svg>
  )
}
