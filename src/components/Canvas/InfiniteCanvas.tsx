import React, { useRef, useEffect, useCallback } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { useCanvasEvents } from "../../hooks/useCanvasEvents"
import { Grid } from "./Grid"
import { Renderer } from "./Renderer"
import { getStroke } from "perfect-freehand"
import { getSvgPathFromStroke, simplifyStroke } from "../../utils/brushEngine"
import { DEFAULT_BRUSH } from "../../utils/brushConfig"

export const InfiniteCanvas: React.FC = () => {
  const ui = useCanvasStore((state) => state.ui)
  const addStroke = useCanvasStore((s) => s.addStroke)
  const setCamera = useCanvasStore((s) => s.setCamera)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  const rafRef = useRef<number | null>(null)

  const currentPointsRef = useRef<Array<{ x: number; y: number; pressure: number }>>([])
  const cameraRef = useRef(ui.camera)

  useEffect(() => {
    cameraRef.current = ui.camera
  }, [ui.camera])

  useEffect(() => {
    if (!containerRef.current || !overlayCanvasRef.current) return
    const canvas = overlayCanvasRef.current
    const parent = containerRef.current

    const updateLayout = () => {
      rectRef.current = parent.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      canvas.width = rectRef.current.width * dpr
      canvas.height = rectRef.current.height * dpr
      canvas.style.width = `${rectRef.current.width}px`
      canvas.style.height = `${rectRef.current.height}px`

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    updateLayout()
    window.addEventListener("resize", updateLayout)
    window.addEventListener("scroll", updateLayout)
    return () => {
      window.removeEventListener("resize", updateLayout)
      window.removeEventListener("scroll", updateLayout)
      const raf = rafRef.current
      rafRef.current = null
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  const renderLiveStroke = useCallback(() => {
    const canvas = overlayCanvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || currentPointsRef.current.length < 2) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const points = currentPointsRef.current

    const outlinePoints = getStroke(points, {
      ...DEFAULT_BRUSH,
      size: ui.activeWidth,
    })

    ctx.save()
    const cam = cameraRef.current
    ctx.translate(cam.x, cam.y)
    ctx.scale(cam.zoom, cam.zoom)

    ctx.beginPath()
    if (outlinePoints.length > 0) {
      ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1])
      for (let i = 1; i < outlinePoints.length; i++) {
        ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1])
      }
    }
    ctx.closePath()
    ctx.fillStyle = ui.activeColor
    ctx.fill()
    ctx.restore()
  }, [ui.activeWidth, ui.activeColor])

  const { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel } = useCanvasEvents({
    cameraRef,
    rectRef,
    activeTool: ui.activeTool,

    onStrokeStart: (p) => {
      currentPointsRef.current = [{ x: p.x, y: p.y, pressure: p.pressure }]
    },

    onStrokeMove: (p) => {
      currentPointsRef.current.push({ x: p.x, y: p.y, pressure: p.pressure })

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          renderLiveStroke()
          rafRef.current = null
        })
      }
    },

    onStrokeEnd: () => {
      if (currentPointsRef.current.length < 2) return

      const rawPoints = currentPointsRef.current

      const finalPoints = simplifyStroke(rawPoints, 0.5 / cameraRef.current.zoom)

      const strokeOpts = {
        size: ui.activeWidth,
        ...DEFAULT_BRUSH,
      }

      const outline = getStroke(finalPoints, strokeOpts)
      const pathData = getSvgPathFromStroke(outline)

      addStroke({
        id: crypto.randomUUID(),
        pathData,
        points: finalPoints,
        color: ui.activeColor,
        width: ui.activeWidth,
        opacity: ui.activeOpacity,
        tool: ui.activeTool,
        layerId: ui.activeLayerId,
        timestamp: Date.now(),
      })

      currentPointsRef.current = []

      const ctx = overlayCanvasRef.current?.getContext("2d")
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    },

    onPanMove: (dx, dy) => {
      setCamera({
        ...cameraRef.current,
        x: cameraRef.current.x + dx,
        y: cameraRef.current.y + dy,
      })
    },
    onZoom: (newCamera) => {
      setCamera(newCamera)
    },
  })

  const cursorClass =
    ui.activeTool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-slate-50 overflow-hidden touch-none select-none ${cursorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <g transform={`translate(${ui.camera.x}, ${ui.camera.y}) scale(${ui.camera.zoom})`}>
          <Grid camera={ui.camera} />
          <Renderer />
        </g>
      </svg>
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
    </div>
  )
}
