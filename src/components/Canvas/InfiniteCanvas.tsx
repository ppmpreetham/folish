import React, { useRef, useEffect, useCallback, useState } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { useCanvasEvents } from "../../hooks/useCanvasEvents"
import { Grid } from "./Grid"
import { Renderer } from "./Renderer"
import { SelectionOverlay } from "./SelectionOverlay"
import { SpatialIndexStats } from "../Debug/SpatialIndexStats"
import { getStroke } from "perfect-freehand"
import { getSvgPathFromStroke } from "../../utils/brushEngine"
import { DEFAULT_BRUSH } from "../../utils/brushConfig"
import type { Bounds, Point, Stroke } from "../../types"
import { hasToolFunction } from "../../utils/toolsData"

const V_MAX = 12
const ALPHA_MIN = 0.15
const ALPHA_MAX = 0.85
const SELECTION_DRAG_THRESHOLD_PX = 3

type SelectionInteraction = {
  origin: CanvasPoint
  initialSelectedIds: string[]
  mode: "pending" | "brushing" | "translating"
  hasHitStroke: boolean
  lassoPoints: CanvasPoint[]
}

type CanvasPoint = Pick<Point, "x" | "y">

type TextDraft = {
  id: string
  sourceTextId?: string
  x: number
  y: number
  width: number
  height: number
  text: string
  layerId: string
  color: string
  opacity: number
}

const TEXT_MIN_WIDTH_PX = 160
const TEXT_MIN_HEIGHT_PX = 32
const showSpatialIndexStats = import.meta.env.DEV

const selectionEquals = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

const getLassoBounds = (points: CanvasPoint[]): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const isPointInPolygon = (point: CanvasPoint, polygon: CanvasPoint[]) => {
  let isInside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      isInside = !isInside
    }
  }
  return isInside
}

const isPointInBounds = (point: CanvasPoint, bounds: Bounds) =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height

const segmentsIntersect = (a: CanvasPoint, b: CanvasPoint, c: CanvasPoint, d: CanvasPoint) => {
  const cross = (origin: CanvasPoint, first: CanvasPoint, second: CanvasPoint) =>
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)
  const isOnSegment = (start: CanvasPoint, point: CanvasPoint, end: CanvasPoint) =>
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  if (abC === 0 && isOnSegment(a, c, b)) return true
  if (abD === 0 && isOnSegment(a, d, b)) return true
  if (cdA === 0 && isOnSegment(c, a, d)) return true
  if (cdB === 0 && isOnSegment(c, b, d)) return true
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0)
}

const lassoIntersectsBounds = (lasso: CanvasPoint[], bounds: Bounds) => {
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
  if (lasso.some((point) => isPointInBounds(point, bounds))) return true
  if (corners.some((point) => isPointInPolygon(point, lasso))) return true
  for (let index = 0; index < lasso.length; index++) {
    const a = lasso[index]
    const b = lasso[(index + 1) % lasso.length]
    for (let edge = 0; edge < corners.length; edge++) {
      if (segmentsIntersect(a, b, corners[edge], corners[(edge + 1) % corners.length])) return true
    }
  }
  return false
}

const lassoContainsBounds = (lasso: CanvasPoint[], bounds: Bounds) =>
  [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].every((point) => isPointInPolygon(point, lasso))

const pointHitsStroke = (stroke: Stroke, point: CanvasPoint, zoom: number) => {
  const offsetX = stroke.offset?.x ?? 0
  const offsetY = stroke.offset?.y ?? 0
  const tolerance = Math.max(stroke.width * 1.5, 8 / zoom)
  const toleranceSquared = tolerance * tolerance
  const points = stroke.points

  if (!points?.length) return true
  if (points.length === 1) {
    const dx = point.x - (points[0].x + offsetX)
    const dy = point.y - (points[0].y + offsetY)
    return dx * dx + dy * dy <= toleranceSquared
  }

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]
    const end = points[i]
    const ax = start.x + offsetX
    const ay = start.y + offsetY
    const bx = end.x + offsetX
    const by = end.y + offsetY
    const abx = bx - ax
    const aby = by - ay
    const lengthSquared = abx * abx + aby * aby
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - ax) * abx + (point.y - ay) * aby) / lengthSquared))
    const dx = point.x - (ax + abx * t)
    const dy = point.y - (ay + aby * t)
    if (dx * dx + dy * dy <= toleranceSquared) return true
  }

  return false
}

export const InfiniteCanvas: React.FC = () => {
  const ui = useCanvasStore((state) => state.ui)
  const addStroke = useCanvasStore((s) => s.addStroke)
  const addText = useCanvasStore((s) => s.addText)
  const updateText = useCanvasStore((s) => s.updateText)
  const setCamera = useCanvasStore((s) => s.setCamera)
  const currentInputTypeRef = useRef<string>("mouse")

  const containerRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const rafRef = useRef<number | null>(null)

  const currentPointsRef = useRef<Array<{ x: number; y: number; pressure: number }>>([])
  const cameraRef = useRef(ui.camera)
  const lastStablePointRef = useRef<{ x: number; y: number } | null>(null)
  const selectionRef = useRef<SelectionInteraction | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const textDraftRef = useRef<TextDraft | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)

  useEffect(() => {
    cameraRef.current = ui.camera
  }, [ui.camera])

  useEffect(() => {
    if (!textDraft) return
    textAreaRef.current?.focus()
  }, [textDraft])

  const setTextDraftState = useCallback((draft: TextDraft | null) => {
    textDraftRef.current = draft
    setTextDraft(draft)
  }, [])

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
        ctx.imageSmoothingEnabled = false
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

  const findTopmostStrokeAtPoint = useCallback((point: CanvasPoint) => {
    const state = useCanvasStore.getState()
    const tolerance = 10 / cameraRef.current.zoom
    const candidates = state.spatialIndex.query({
      x: point.x - tolerance,
      y: point.y - tolerance,
      width: tolerance * 2,
      height: tolerance * 2,
    })

    for (let layerIndex = state.doc.layers.length - 1; layerIndex >= 0; layerIndex--) {
      const layer = state.doc.layers[layerIndex]
      if (!layer.visible || layer.locked) continue
      const candidateIds = candidates[layer.id]
      if (!candidateIds?.length) continue
      const candidateIdSet = new Set(candidateIds)

      for (let textIndex = (layer.textIds?.length ?? 0) - 1; textIndex >= 0; textIndex--) {
        const textId = layer.textIds![textIndex]
        const text = state.doc.texts[textId]
        if (text && candidateIdSet.has(text.id)) return text.id
      }

      for (let strokeIndex = layer.strokeIds.length - 1; strokeIndex >= 0; strokeIndex--) {
        const stroke = state.doc.strokes[layer.strokeIds[strokeIndex]]
        if (stroke && candidateIdSet.has(stroke.id) && pointHitsStroke(stroke, point, cameraRef.current.zoom)) {
          return stroke.id
        }
      }
    }

    return undefined
  }, [])

  const updateLassoSelection = useCallback(
    (
      lassoPoints: CanvasPoint[],
      initialSelectedIds: string[],
      additive: boolean,
      wrapping: boolean,
    ) => {
      const state = useCanvasStore.getState()
      if (lassoPoints.length < 3) return
      const candidates = state.spatialIndex.query(getLassoBounds(lassoPoints))
      const nextIds = new Set(additive ? initialSelectedIds : [])

      for (const layer of state.doc.layers) {
        if (!layer.visible || layer.locked) continue
        const candidateIds = candidates[layer.id]
        if (!candidateIds) continue
        for (const id of candidateIds) {
          const bounds = state.doc.strokes[id]?.bounds ?? state.doc.texts[id]?.bounds
          if (!bounds) continue
          if (wrapping ? lassoContainsBounds(lassoPoints, bounds) : lassoIntersectsBounds(lassoPoints, bounds)) {
            nextIds.add(id)
          }
        }
      }

      const selectedIds = Array.from(nextIds)
      if (!selectionEquals(state.ui.selectedStrokeIds, selectedIds)) {
        state.setSelectedStrokes(selectedIds)
      }
    },
    [],
  )

  const handleSelectionStart = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const state = useCanvasStore.getState()
      const hitStrokeId = findTopmostStrokeAtPoint(point)
      const initialSelectedIds = state.ui.selectedStrokeIds

      if (hitStrokeId) {
        const selectedIds = modifiers.shiftKey
          ? initialSelectedIds.includes(hitStrokeId)
            ? initialSelectedIds.filter((id) => id !== hitStrokeId)
            : [...initialSelectedIds, hitStrokeId]
          : initialSelectedIds.includes(hitStrokeId)
            ? initialSelectedIds
            : [hitStrokeId]
        state.setSelectedStrokes(selectedIds)
        selectionRef.current = {
          origin: point,
          initialSelectedIds: selectedIds,
          mode: "pending",
          hasHitStroke: true,
          lassoPoints: [point],
        }
      } else {
        if (!modifiers.shiftKey && initialSelectedIds.length) state.setSelectedStrokes([])
        selectionRef.current = {
          origin: point,
          initialSelectedIds,
          mode: "pending",
          hasHitStroke: false,
          lassoPoints: [point],
        }
      }
    },
    [findTopmostStrokeAtPoint],
  )

  const handleSelectionMove = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const interaction = selectionRef.current
      if (!interaction) return

      const dx = point.x - interaction.origin.x
      const dy = point.y - interaction.origin.y
      if (
        interaction.mode === "pending" &&
        Math.hypot(dx, dy) * cameraRef.current.zoom < SELECTION_DRAG_THRESHOLD_PX
      ) {
        return
      }

      const state = useCanvasStore.getState()
      if (interaction.mode === "pending") {
        interaction.mode = interaction.hasHitStroke ? "translating" : "brushing"
      }

      if (interaction.mode === "translating") {
        state.setSelectionTranslation({ x: dx, y: dy })
        return
      }

      const lastPoint = interaction.lassoPoints[interaction.lassoPoints.length - 1]
      const minDistance = 2 / cameraRef.current.zoom
      if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= minDistance) {
        interaction.lassoPoints.push(point)
      }
      state.setSelectionLasso({ points: [...interaction.lassoPoints] })
      updateLassoSelection(
        interaction.lassoPoints,
        interaction.initialSelectedIds,
        modifiers.shiftKey,
        modifiers.ctrlKey || modifiers.metaKey,
      )
    },
    [updateLassoSelection],
  )

  const handleSelectionEnd = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const interaction = selectionRef.current
      selectionRef.current = null
      if (!interaction) return

      const state = useCanvasStore.getState()
      const dx = point.x - interaction.origin.x
      const dy = point.y - interaction.origin.y
      if (interaction.mode === "translating") {
        state.translateStrokes(state.ui.selectedStrokeIds, dx, dy)
        state.setSelectionTranslation({ x: 0, y: 0 })
      } else if (interaction.mode === "brushing") {
        if (interaction.lassoPoints.length < 3) interaction.lassoPoints.push(point)
        updateLassoSelection(
          interaction.lassoPoints,
          interaction.initialSelectedIds,
          modifiers.shiftKey,
          modifiers.ctrlKey || modifiers.metaKey,
        )
        state.setSelectionLasso(null)
      }
    },
    [updateLassoSelection],
  )

  const commitText = useCallback((draftId?: string) => {
    const draft = textDraftRef.current
    if (!draft || (draftId && draft.id !== draftId)) return
    textDraftRef.current = null
    setTextDraft(null)

    const text = draft.text.trimEnd()
    if (draft.sourceTextId) {
      updateText(draft.sourceTextId, { text, width: draft.width, height: draft.height })
    } else if (text) {
      addText({
        layerId: draft.layerId,
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
        text,
        color: draft.color,
        opacity: draft.opacity,
      })
    }
  }, [addText, updateText])

  const handleTextStart = useCallback((point: CanvasPoint) => {
    const state = useCanvasStore.getState()
    const hitShapeId = findTopmostStrokeAtPoint(point)
    const existingText = hitShapeId ? state.doc.texts[hitShapeId] : undefined
    if (existingText) {
      const textLayer = state.doc.layers.find((candidate) => candidate.id === existingText.layerId)
      if (textLayer?.locked) return
      commitText()
      state.setSelectedStrokes([existingText.id])
      setTextDraftState({
        id: crypto.randomUUID(),
        sourceTextId: existingText.id,
        x: existingText.x + (existingText.offset?.x ?? 0),
        y: existingText.y + (existingText.offset?.y ?? 0),
        width: existingText.width,
        height: existingText.height,
        text: existingText.text,
        layerId: existingText.layerId,
        color: existingText.color,
        opacity: existingText.opacity,
      })
      return
    }
    const layer = state.doc.layers.find((candidate) => candidate.id === state.ui.activeLayerId)
    if (!layer || layer.locked) return
    const zoom = cameraRef.current.zoom
    commitText()
    setTextDraftState({
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      width: TEXT_MIN_WIDTH_PX / zoom,
      height: TEXT_MIN_HEIGHT_PX / zoom,
      text: "",
      layerId: layer.id,
      color: state.ui.activeColor,
      opacity: state.ui.activeOpacity,
    })
  }, [commitText, findTopmostStrokeAtPoint, setTextDraftState])

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
    onSelectionStart: handleSelectionStart,
    onSelectionMove: handleSelectionMove,
    onSelectionEnd: handleSelectionEnd,
    onTextStart: handleTextStart,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => e.preventDefault()
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const cursorClass =
    ui.activeTool === "pan"
      ? "cursor-grab active:cursor-grabbing"
      : ui.activeTool === "select" || hasToolFunction(ui.activeTool, "select") || hasToolFunction(ui.activeTool, "nudge")
        ? "cursor-default"
        : "cursor-crosshair"

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
          <SelectionOverlay />
        </g>
      </svg>
      {showSpatialIndexStats && <SpatialIndexStats />}
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      {textDraft && (
        <>
          <svg className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
            <g stroke="#475569" strokeWidth={0.5} opacity={0.35}>
              <line x1={textDraft.x * ui.camera.zoom + ui.camera.x} y1={0} x2={textDraft.x * ui.camera.zoom + ui.camera.x} y2="100%" />
              <line x1={(textDraft.x + textDraft.width) * ui.camera.zoom + ui.camera.x} y1={0} x2={(textDraft.x + textDraft.width) * ui.camera.zoom + ui.camera.x} y2="100%" />
              <line x1={0} y1={textDraft.y * ui.camera.zoom + ui.camera.y} x2="100%" y2={textDraft.y * ui.camera.zoom + ui.camera.y} />
              <line x1={0} y1={(textDraft.y + textDraft.height) * ui.camera.zoom + ui.camera.y} x2="100%" y2={(textDraft.y + textDraft.height) * ui.camera.zoom + ui.camera.y} />
            </g>
          </svg>
          <textarea
            ref={textAreaRef}
            value={textDraft.text}
            wrap="off"
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              const element = event.currentTarget
              const zoom = cameraRef.current.zoom
              const current = textDraftRef.current
              if (!current) return
              setTextDraftState({
                ...current,
                text: element.value,
                width: Math.max(TEXT_MIN_WIDTH_PX / zoom, element.scrollWidth / zoom),
                height: Math.max(TEXT_MIN_HEIGHT_PX / zoom, element.scrollHeight / zoom),
              })
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                commitText(textDraft.id)
              }
              if (event.key === "Escape") {
                event.preventDefault()
                setTextDraftState(null)
              }
            }}
            onBlur={() => commitText(textDraft.id)}
            className="absolute z-20 resize-none overflow-hidden bg-transparent outline-none select-text"
            style={{
              left: textDraft.x * ui.camera.zoom + ui.camera.x,
              top: textDraft.y * ui.camera.zoom + ui.camera.y,
              width: textDraft.width * ui.camera.zoom,
              height: textDraft.height * ui.camera.zoom,
              minWidth: TEXT_MIN_WIDTH_PX,
              minHeight: TEXT_MIN_HEIGHT_PX,
              padding: 0,
              border: "none",
              color: textDraft.color,
              opacity: textDraft.opacity,
              fontFamily: "inherit",
              fontSize: `${16 * ui.camera.zoom}px`,
              lineHeight: 1.25,
              whiteSpace: "pre",
            }}
          />
        </>
      )}
    </div>
  )
}
