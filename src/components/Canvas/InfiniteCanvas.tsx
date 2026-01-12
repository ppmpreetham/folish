import React, { useRef, useEffect, useReducer } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { useCanvasEvents } from "../../hooks/useCanvasEvents"
import { Point, Camera } from "../../types"
import { Grid } from "./Grid"
import { Renderer } from "./Renderer"
import simplify from "simplify-js"
import { getStroke } from "perfect-freehand"

export const InfiniteCanvas: React.FC = () => {
  const doc = useCanvasStore((state) => state.doc)
  const ui = useCanvasStore((state) => state.ui)
  const actions = useCanvasStore()

  const containerRef = useRef<SVGSVGElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const cameraRef = useRef<Camera>(ui.camera)

  const currentPointsRef = useRef<Array<[number, number, number]>>([])
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

  const { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel } = useCanvasEvents({
    cameraRef,
    rectRef,
    activeTool: ui.activeTool,
    onStrokeStart: (p) => {
      currentPointsRef.current = [[p.x, p.y, p.pressure]]
    },
    onStrokeMove: (p) => {
      currentPointsRef.current.push([p.x, p.y, p.pressure])
      forceUpdate()
    },
    onStrokeEnd: () => {
      if (currentPointsRef.current.length < 2) return

      const strokeOutline = getStroke(currentPointsRef.current, {
        size: ui.activeWidth * 2,
        thinning: 0.65,
        smoothing: 0.55,
        streamline: 0.5,
        simulatePressure: false,
      })

      const pathData = getSvgPathFromStroke(strokeOutline)

      const simplifiedPoints = simplify(
        currentPointsRef.current.map(([x, y]) => ({ x, y })),
        1.0,
        true
      )

      actions.addStroke({
        id: crypto.randomUUID(),

        pathData,
        points: simplifiedPoints,
        pressure: currentPointsRef.current.map(([, , p]) => p),
        color: ui.activeColor,
        width: ui.activeWidth,
        opacity: ui.activeOpacity,
        tool: ui.activeTool,
        layerId: ui.activeLayerId,
        timestamp: Date.now(),
      })

      currentPointsRef.current = []
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

  const cursorClass =
    ui.activeTool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"

  return (
    <svg
      ref={containerRef}
      className={`w-full h-full bg-slate-50 overflow-hidden touch-none select-none ${cursorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g transform={`translate(${ui.camera.x}, ${ui.camera.y}) scale(${ui.camera.zoom})`}>
        <Grid camera={ui.camera} />
        <Renderer zoom={ui.camera.zoom} />

        {currentPointsRef.current.length > 1 &&
          (() => {
            const outline = getStroke(currentPointsRef.current, {
              size: ui.activeWidth * 3.0,
              thinning: 0.75,
              smoothing: 0.52,
              streamline: 0.5,
              simulatePressure: false,
              last: true,
            })

            const pathData = getSvgPathFromStroke(outline)

            return (
              <path
                d={pathData}
                fill={ui.activeColor}
                stroke="none"
                opacity={0.75}
                className="pointer-events-none"
              />
            )
          })()}
      </g>
    </svg>
  )
}

export function getSvgPathFromStroke(points: number[][]): string {
  if (points.length < 4) return ""

  const d: string[] = []

  d.push(`M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`)

  for (let i = 1; i < points.length; i++) {
    const midX = (points[i][0] + points[i - 1][0]) / 2
    const midY = (points[i][1] + points[i - 1][1]) / 2
    d.push(
      `Q${points[i - 1][0].toFixed(2)},${points[i - 1][1].toFixed(2)} ` +
        `${midX.toFixed(2)},${midY.toFixed(2)}`
    )
  }

  d.push("Z")

  return d.join(" ")
}
