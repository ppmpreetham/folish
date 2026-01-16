import React, { useRef, useEffect, useCallback } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { useCanvasEvents } from "../../hooks/useCanvasEvents"
import { Grid } from "./Grid"
import { Renderer } from "./Renderer"
import { getStroke } from "perfect-freehand"
import { getSvgPathFromStroke } from "../../utils/brushEngine"
import { DEFAULT_BRUSH } from "../../utils/brushConfig"

const V_MAX = 12
const ALPHA_MIN = 0.15
const ALPHA_MAX = 0.85

export const InfiniteCanvas: React.FC = () => {
  const ui = useCanvasStore((state) => state.ui)
  const addStroke = useCanvasStore((s) => s.addStroke)
  const setCamera = useCanvasStore((s) => s.setCamera)
  const currentInputTypeRef = useRef<string>("mouse")

  const containerRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const rafRef = useRef<number | null>(null)

  const currentPointsRef = useRef<Array<{ x: number; y: number; pressure: number }>>([])
  const cameraRef = useRef(ui.camera)
  const lastStablePointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    cameraRef.current = ui.camera
  }, [ui.camera])

  useEffect(() => {
    if (!containerRef.current || !overlayCanvasRef.current) return
    const canvas = overlayCanvasRef.current
    const parent = containerRef.current

    const updateLayout = () => {
      const rect = parent.getBoundingClientRect()
      rectRef.current = rect
      const dpr = window.devicePixelRatio || 1

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
      }

      setCamera(cameraRef.current)
    }

    const observer = new ResizeObserver(updateLayout)
    observer.observe(parent)
    updateLayout()

    window.addEventListener("scroll", updateLayout)
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", updateLayout)
      const raf = rafRef.current
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [setCamera])

  const renderLiveStroke = useCallback(() => {
    const canvas = overlayCanvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || currentPointsRef.current.length < 2) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const points = currentPointsRef.current
    const isPen = currentInputTypeRef.current === "pen"

    const outlinePoints = getStroke(points, {
      ...DEFAULT_BRUSH,
      size: ui.activeWidth,
      simulatePressure: !isPen,
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
      currentInputTypeRef.current = p.pointerType
      currentPointsRef.current = [{ x: p.x, y: p.y, pressure: p.pressure }]
      lastStablePointRef.current = { x: p.x, y: p.y }
    },

    onStrokeMove: (p) => {
      const points = currentPointsRef.current
      const lastPoint = points[points.length - 1]
      const lastStable = lastStablePointRef.current

      if (lastPoint) {
        const dx = p.x - lastPoint.x
        const dy = p.y - lastPoint.y

        const dist = Math.hypot(dx, dy)
        const speed = dist

        const base = 0.75 / cameraRef.current.zoom
        const threshold = Math.max(base, speed * 0.25)

        if (dist < threshold) return
      }
      const newPressure = p.pointerType === "pen" ? p.pressure : 0.5
      if (!lastStable) {
        currentPointsRef.current.push({
          x: p.x,
          y: p.y,
          pressure: newPressure,
        })
        lastStablePointRef.current = { x: p.x, y: p.y }
      } else {
        const dx = p.x - lastStable.x
        const dy = p.y - lastStable.y
        const dist = Math.hypot(dx, dy)
        const speed = dist

        const zoomFactor = Math.sqrt(cameraRef.current.zoom)
        const alpha = Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, (speed * zoomFactor) / V_MAX))

        const sx = lastStable.x + (p.x - lastStable.x) * alpha
        const sy = lastStable.y + (p.y - lastStable.y) * alpha

        lastStablePointRef.current = { x: sx, y: sy }

        currentPointsRef.current.push({
          x: sx,
          y: sy,
          pressure: newPressure,
        })
      }

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
      const isPen = currentInputTypeRef.current === "pen"

      const strokeOpts = {
        size: ui.activeWidth,
        ...DEFAULT_BRUSH,
        simulatePressure: !isPen,
      }

      const outline = getStroke(rawPoints, strokeOpts)
      const pathData = getSvgPathFromStroke(outline)

      addStroke({
        id: crypto.randomUUID(),
        pathData,
        points: rawPoints,
        color: ui.activeColor,
        width: ui.activeWidth,
        opacity: ui.activeOpacity,
        tool: ui.activeTool,
        layerId: ui.activeLayerId,
        timestamp: Date.now(),
      })

      currentPointsRef.current = []
      lastStablePointRef.current = null

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

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => e.preventDefault()
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const cursorClass =
    ui.activeTool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-slate-50 overflow-hidden touch-none overscroll-none select-none ${cursorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        shapeRendering="geometricPrecision"
      >
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
