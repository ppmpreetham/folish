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
import { boundsIntersect } from "../../utils/bounds"
import { transformSelectionPoint } from "../../utils/selectionTransform"
import type { Bounds, Point, Stroke } from "../../types"
import { hasToolFunction } from "../../utils/toolsData"

const V_MAX = 12
const ALPHA_MIN = 0.15
const ALPHA_MAX = 0.85
const SELECTION_DRAG_THRESHOLD_PX = 3

type SelectionInteraction = {
  origin: CanvasPoint
  initialSelectedIds: string[]
  mode: "pending" | "brushing" | "marquee" | "translating" | "scaling" | "rotating"
  hasHitStroke: boolean
  lassoPoints: CanvasPoint[]
  bounds?: Bounds
  transformOrigin?: CanvasPoint
  startAngle?: number
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

type FillInteraction = {
  points: CanvasPoint[]
  layerId: string
  color: string
  opacity: number
}

type NudgeInteraction = {
  strokeId: string
  origin: CanvasPoint
  originalPoints: Point[]
  influences: number[]
}

const TEXT_MIN_WIDTH_PX = 160
const TEXT_MIN_HEIGHT_PX = 32
const NUDGE_RADIUS_PX = 72
const TRANSFORM_HANDLE_RADIUS_PX = 12
const MIN_SELECTION_SCALE = 0.05
const showSpatialIndexStats = import.meta.env.DEV

const selectionEquals = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

const mergeSelectionBounds = (state: ReturnType<typeof useCanvasStore.getState>, ids: string[]) => {
  let bounds: Bounds | undefined
  for (const id of ids) {
    const next = state.doc.strokes[id]?.bounds ?? state.doc.texts[id]?.bounds
    if (!next) continue
    if (!bounds) {
      bounds = { ...next }
      continue
    }
    const right = Math.max(bounds.x + bounds.width, next.x + next.width)
    const bottom = Math.max(bounds.y + bounds.height, next.y + next.height)
    bounds.x = Math.min(bounds.x, next.x)
    bounds.y = Math.min(bounds.y, next.y)
    bounds.width = right - bounds.x
    bounds.height = bottom - bounds.y
  }
  return bounds
}

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

const getStrokeWorldPoints = (stroke: Stroke): CanvasPoint[] => {
  const offsetX = stroke.offset?.x ?? 0
  const offsetY = stroke.offset?.y ?? 0
  return stroke.points.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }))
}

const pathsIntersect = (
  first: CanvasPoint[],
  second: CanvasPoint[],
  closeFirst: boolean,
  closeSecond: boolean,
) => {
  const firstSegments = Math.max(0, first.length - 1 + Number(closeFirst && first.length > 2))
  const secondSegments = Math.max(0, second.length - 1 + Number(closeSecond && second.length > 2))
  for (let firstIndex = 0; firstIndex < firstSegments; firstIndex++) {
    const firstStart = first[firstIndex]
    const firstEnd = first[(firstIndex + 1) % first.length]
    for (let secondIndex = 0; secondIndex < secondSegments; secondIndex++) {
      const secondStart = second[secondIndex]
      const secondEnd = second[(secondIndex + 1) % second.length]
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return true
    }
  }
  return false
}

const lassoHitsStroke = (lasso: CanvasPoint[], stroke: Stroke, zoom: number, wrapping: boolean) => {
  const points = getStrokeWorldPoints(stroke)
  if (points.length === 0) return false

  if (wrapping) return points.every((point) => isPointInPolygon(point, lasso))

  if (stroke.tool === "fill") {
    return (
      points.some((point) => isPointInPolygon(point, lasso)) ||
      lasso.some((point) => isPointInPolygon(point, points)) ||
      pathsIntersect(lasso, points, true, true)
    )
  }

  if (points.some((point) => isPointInPolygon(point, lasso))) return true
  if (pathsIntersect(lasso, points, true, false)) return true
  return lasso.some((point) => pointsHitStroke(points, stroke.width, point, zoom))
}

const getClosedPathData = (points: CanvasPoint[]) =>
  points.length < 3 ? "" : `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`

const pointsHitStroke = (points: CanvasPoint[], width: number, point: CanvasPoint, zoom: number) => {
  const tolerance = Math.max(width * 1.5, 8 / zoom)
  const toleranceSquared = tolerance * tolerance

  if (!points.length) return true
  if (points.length === 1) {
    const dx = point.x - points[0].x
    const dy = point.y - points[0].y
    return dx * dx + dy * dy <= toleranceSquared
  }

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]
    const end = points[i]
    const ax = start.x
    const ay = start.y
    const bx = end.x
    const by = end.y
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

const pointHitsStroke = (stroke: Stroke, point: CanvasPoint, zoom: number) => {
  const points = getStrokeWorldPoints(stroke)
  if (stroke.tool === "fill") return isPointInPolygon(point, points)
  return pointsHitStroke(points, stroke.width, point, zoom)
}

export const InfiniteCanvas: React.FC = () => {
  const ui = useCanvasStore((state) => state.ui)
  const addStroke = useCanvasStore((s) => s.addStroke)
  const addText = useCanvasStore((s) => s.addText)
  const updateText = useCanvasStore((s) => s.updateText)
  const updateStrokeGeometry = useCanvasStore((s) => s.updateStrokeGeometry)
  const commitShapeTransform = useCanvasStore((s) => s.commitShapeTransform)
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
  const nudgeRef = useRef<NudgeInteraction | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const textDraftRef = useRef<TextDraft | null>(null)
  const fillRef = useRef<FillInteraction | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [fillPreview, setFillPreview] = useState<CanvasPoint[] | null>(null)

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
    const rect = rectRef.current
    const centerX = rect?.width ? rect.width / 2 : canvas.clientWidth / 2
    const centerY = rect?.height ? rect.height / 2 : canvas.clientHeight / 2
    ctx.translate(centerX, centerY)
    ctx.rotate((cam.rotation * Math.PI) / 180)
    ctx.translate(-centerX, -centerY)
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
          const stroke = state.doc.strokes[id]
          const text = state.doc.texts[id]
          const bounds = stroke?.bounds ?? text?.bounds
          if (!bounds) continue
          const isSelected = stroke
            ? lassoHitsStroke(lassoPoints, stroke, cameraRef.current.zoom, wrapping)
            : wrapping
              ? lassoContainsBounds(lassoPoints, bounds)
              : lassoIntersectsBounds(lassoPoints, bounds)
          if (isSelected) {
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

  const updateMarqueeSelection = useCallback(
    (marquee: Bounds, initialSelectedIds: string[], additive: boolean, wrapping: boolean) => {
      const state = useCanvasStore.getState()
      const candidates = state.spatialIndex.query(marquee)
      const nextIds = new Set(additive ? initialSelectedIds : [])
      for (const layer of state.doc.layers) {
        if (!layer.visible || layer.locked) continue
        for (const id of candidates[layer.id] ?? []) {
          const bounds = state.doc.strokes[id]?.bounds ?? state.doc.texts[id]?.bounds
          if (!bounds) continue
          const isSelected = wrapping
            ? marquee.x <= bounds.x && marquee.y <= bounds.y && marquee.x + marquee.width >= bounds.x + bounds.width && marquee.y + marquee.height >= bounds.y + bounds.height
            : boundsIntersect(marquee, bounds)
          if (isSelected) nextIds.add(id)
        }
      }
      const selectedIds = Array.from(nextIds)
      if (!selectionEquals(state.ui.selectedStrokeIds, selectedIds)) state.setSelectedStrokes(selectedIds)
    },
    [],
  )

  const handleSelectionStart = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const state = useCanvasStore.getState()
      if (hasToolFunction(state.ui.activeTool, "marquee")) {
        const initialSelectedIds = state.ui.selectedStrokeIds
        const selectedBounds = mergeSelectionBounds(state, initialSelectedIds)
        const handleRadius = TRANSFORM_HANDLE_RADIUS_PX / cameraRef.current.zoom
        const resetTransform = () => {
          state.setSelectionTranslation({ x: 0, y: 0 })
          state.setSelectionScale({ x: 1, y: 1 })
          state.setSelectionRotation(0)
          state.setSelectionTransformOrigin(null)
        }
        if (selectedBounds) {
          const center = {
            x: selectedBounds.x + selectedBounds.width / 2,
            y: selectedBounds.y + selectedBounds.height / 2,
          }
          const rotateHandle = { x: center.x, y: selectedBounds.y - 28 / cameraRef.current.zoom }
          if (Math.hypot(point.x - rotateHandle.x, point.y - rotateHandle.y) <= handleRadius) {
            resetTransform()
            state.setSelectionTransformOrigin(center)
            selectionRef.current = {
              origin: point,
              initialSelectedIds,
              mode: "rotating",
              hasHitStroke: true,
              lassoPoints: [point],
              bounds: selectedBounds,
              transformOrigin: center,
              startAngle: Math.atan2(point.y - center.y, point.x - center.x),
            }
            return
          }

          const corners = [
            { x: selectedBounds.x, y: selectedBounds.y, opposite: { x: selectedBounds.x + selectedBounds.width, y: selectedBounds.y + selectedBounds.height } },
            { x: selectedBounds.x + selectedBounds.width, y: selectedBounds.y, opposite: { x: selectedBounds.x, y: selectedBounds.y + selectedBounds.height } },
            { x: selectedBounds.x + selectedBounds.width, y: selectedBounds.y + selectedBounds.height, opposite: { x: selectedBounds.x, y: selectedBounds.y } },
            { x: selectedBounds.x, y: selectedBounds.y + selectedBounds.height, opposite: { x: selectedBounds.x + selectedBounds.width, y: selectedBounds.y } },
          ]
          const corner = corners.find((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y) <= handleRadius)
          if (corner) {
            resetTransform()
            state.setSelectionTransformOrigin(corner.opposite)
            selectionRef.current = {
              origin: point,
              initialSelectedIds,
              mode: "scaling",
              hasHitStroke: true,
              lassoPoints: [point],
              bounds: selectedBounds,
              transformOrigin: corner.opposite,
            }
            return
          }
          if (isPointInBounds(point, selectedBounds)) {
            resetTransform()
            state.setSelectionTransformOrigin(center)
            selectionRef.current = {
              origin: point,
              initialSelectedIds,
              mode: "translating",
              hasHitStroke: true,
              lassoPoints: [point],
              bounds: selectedBounds,
              transformOrigin: center,
            }
            return
          }
        }
        if (!modifiers.shiftKey && initialSelectedIds.length) state.setSelectedStrokes([])
        selectionRef.current = {
          origin: point,
          initialSelectedIds,
          mode: "pending",
          hasHitStroke: false,
          lassoPoints: [point],
        }
        return
      }
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
      if (interaction.mode === "translating") {
        state.setSelectionTranslation({ x: dx, y: dy })
        return
      }
      if (interaction.mode === "scaling") {
        const origin = interaction.transformOrigin!
        const startX = interaction.origin.x - origin.x
        const startY = interaction.origin.y - origin.y
        const nextX = point.x - origin.x
        const nextY = point.y - origin.y
        state.setSelectionScale({
          x: Math.max(MIN_SELECTION_SCALE, Math.abs(startX) < 0.001 ? 1 : nextX / startX),
          y: Math.max(MIN_SELECTION_SCALE, Math.abs(startY) < 0.001 ? 1 : nextY / startY),
        })
        return
      }
      if (interaction.mode === "rotating") {
        const origin = interaction.transformOrigin!
        const angle = Math.atan2(point.y - origin.y, point.x - origin.x)
        state.setSelectionRotation(((angle - interaction.startAngle!) * 180) / Math.PI)
        return
      }
      if (interaction.mode === "pending") {
        if (hasToolFunction(state.ui.activeTool, "marquee")) {
          interaction.mode = "marquee"
        } else if (!interaction.hasHitStroke) {
          interaction.mode = "brushing"
        } else {
          interaction.mode = "translating"
        }
      }

      if (interaction.mode === "translating") {
        state.setSelectionTranslation({ x: dx, y: dy })
        return
      }

      if (interaction.mode === "marquee") {
        const marquee = {
          x: Math.min(interaction.origin.x, point.x),
          y: Math.min(interaction.origin.y, point.y),
          width: Math.abs(point.x - interaction.origin.x),
          height: Math.abs(point.y - interaction.origin.y),
        }
        state.setSelectionMarquee(marquee)
        updateMarqueeSelection(marquee, interaction.initialSelectedIds, modifiers.shiftKey, modifiers.ctrlKey || modifiers.metaKey)
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
    [updateLassoSelection, updateMarqueeSelection],
  )

  const handleSelectionEnd = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const interaction = selectionRef.current
      selectionRef.current = null
      if (!interaction) return

      const state = useCanvasStore.getState()
      const dx = point.x - interaction.origin.x
      const dy = point.y - interaction.origin.y
      if (interaction.mode === "translating" || interaction.mode === "scaling" || interaction.mode === "rotating") {
        const origin = interaction.transformOrigin
        if (origin) {
          const { selectionTranslation, selectionScale, selectionRotation } = state.ui
          const selectedIds = state.ui.selectedStrokeIds
          const strokeUpdates = selectedIds.flatMap((id) => {
            const stroke = state.doc.strokes[id]
            if (!stroke) return []
            const offsetX = stroke.offset?.x ?? 0
            const offsetY = stroke.offset?.y ?? 0
            const points = stroke.points.map((strokePoint) => {
              const world = transformSelectionPoint(
                { x: strokePoint.x + offsetX, y: strokePoint.y + offsetY },
                {
                  origin,
                  scale: selectionScale,
                  rotation: selectionRotation,
                  translation: selectionTranslation,
                },
              )
              return { ...strokePoint, x: world.x - offsetX, y: world.y - offsetY }
            })
            const pathData = stroke.tool === "fill"
              ? getClosedPathData(points)
              : getSvgPathFromStroke(getStroke(points, { ...DEFAULT_BRUSH, size: stroke.width }))
            return [{ id, points, pathData }]
          })
          const textUpdates = selectedIds.flatMap((id) => {
            const text = state.doc.texts[id]
            if (!text) return []
            const offsetX = text.offset?.x ?? 0
            const offsetY = text.offset?.y ?? 0
            const position = transformSelectionPoint(
              { x: text.x + offsetX, y: text.y + offsetY },
              {
                origin,
                scale: selectionScale,
                rotation: selectionRotation,
                translation: selectionTranslation,
              },
            )
            return [{
              id,
              x: position.x,
              y: position.y,
              width: Math.max(1, text.width * selectionScale.x),
              height: Math.max(1, text.height * selectionScale.y),
              rotation: (text.rotation ?? 0) + selectionRotation,
            }]
          })
          commitShapeTransform(strokeUpdates, textUpdates)
        } else if (interaction.mode === "translating") {
          state.translateStrokes(state.ui.selectedStrokeIds, dx, dy)
        }
        state.setSelectionTranslation({ x: 0, y: 0 })
        state.setSelectionScale({ x: 1, y: 1 })
        state.setSelectionRotation(0)
        state.setSelectionTransformOrigin(null)
      } else if (interaction.mode === "marquee") {
        const marquee = {
          x: Math.min(interaction.origin.x, point.x),
          y: Math.min(interaction.origin.y, point.y),
          width: Math.abs(point.x - interaction.origin.x),
          height: Math.abs(point.y - interaction.origin.y),
        }
        updateMarqueeSelection(marquee, interaction.initialSelectedIds, modifiers.shiftKey, modifiers.ctrlKey || modifiers.metaKey)
        state.setSelectionMarquee(null)
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
    [commitShapeTransform, updateLassoSelection, updateMarqueeSelection],
  )

  const handleNudgeStart = useCallback((point: CanvasPoint) => {
    const state = useCanvasStore.getState()
    const strokeId = findTopmostStrokeAtPoint(point)
    const stroke = strokeId ? state.doc.strokes[strokeId] : undefined
    if (!stroke || stroke.points.length === 0) return

    const layer = state.doc.layers.find((candidate) => candidate.id === stroke.layerId)
    if (!layer || layer.locked) return
    state.setSelectedStrokes([stroke.id])

    const radius = NUDGE_RADIUS_PX / cameraRef.current.zoom
    const offsetX = stroke.offset?.x ?? 0
    const offsetY = stroke.offset?.y ?? 0
    const influences = stroke.points.map((strokePoint) => {
      const distance = Math.hypot(strokePoint.x + offsetX - point.x, strokePoint.y + offsetY - point.y)
      const normalized = Math.max(0, 1 - distance / radius)
      return normalized * normalized
    })
    const strongest = Math.max(...influences)
    if (strongest === 0) return
    nudgeRef.current = {
      strokeId: stroke.id,
      origin: point,
      originalPoints: stroke.points.map((strokePoint) => ({ ...strokePoint })),
      influences,
    }
  }, [findTopmostStrokeAtPoint])

  const handleNudgeMove = useCallback((point: CanvasPoint) => {
    const interaction = nudgeRef.current
    if (!interaction) return
    const state = useCanvasStore.getState()
    const stroke = state.doc.strokes[interaction.strokeId]
    if (!stroke) return
    const dx = point.x - interaction.origin.x
    const dy = point.y - interaction.origin.y
    const points = interaction.originalPoints.map((strokePoint, index) => ({
      ...strokePoint,
      x: strokePoint.x + dx * interaction.influences[index],
      y: strokePoint.y + dy * interaction.influences[index],
    }))
    const pathData = stroke.tool === "fill"
      ? getClosedPathData(points)
      : getSvgPathFromStroke(getStroke(points, { ...DEFAULT_BRUSH, size: stroke.width }))
    state.setNudgePreview({ strokeId: stroke.id, pathData })
  }, [])

  const handleNudgeEnd = useCallback((point: CanvasPoint) => {
    const interaction = nudgeRef.current
    nudgeRef.current = null
    if (!interaction) return
    const state = useCanvasStore.getState()
    const stroke = state.doc.strokes[interaction.strokeId]
    const dx = point.x - interaction.origin.x
    const dy = point.y - interaction.origin.y
    if (!stroke || Math.hypot(dx, dy) < 0.01) {
      state.setNudgePreview(null)
      return
    }
    const points = interaction.originalPoints.map((strokePoint, index) => ({
      ...strokePoint,
      x: strokePoint.x + dx * interaction.influences[index],
      y: strokePoint.y + dy * interaction.influences[index],
    }))
    const pathData = stroke.tool === "fill"
      ? getClosedPathData(points)
      : getSvgPathFromStroke(getStroke(points, { ...DEFAULT_BRUSH, size: stroke.width }))
    state.setNudgePreview(null)
    updateStrokeGeometry(stroke.id, points, pathData)
  }, [updateStrokeGeometry])

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
    commitText()
    setTextDraftState({
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      width: TEXT_MIN_WIDTH_PX,
      height: TEXT_MIN_HEIGHT_PX,
      text: "",
      layerId: layer.id,
      color: state.ui.activeColor,
      opacity: state.ui.activeOpacity,
    })
  }, [commitText, findTopmostStrokeAtPoint, setTextDraftState])

  const handleFillStart = useCallback((point: CanvasPoint) => {
    const state = useCanvasStore.getState()
    const layer = state.doc.layers.find((candidate) => candidate.id === state.ui.activeLayerId)
    if (!layer || layer.locked) return
    const fill: FillInteraction = {
      points: [point],
      layerId: layer.id,
      color: state.ui.activeColor,
      opacity: state.ui.activeOpacity,
    }
    fillRef.current = fill
    setFillPreview(fill.points)
  }, [])

  const handleFillMove = useCallback((point: CanvasPoint) => {
    const fill = fillRef.current
    if (!fill) return
    const lastPoint = fill.points[fill.points.length - 1]
    const minDistance = 2 / cameraRef.current.zoom
    if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < minDistance) return
    fill.points.push(point)
    setFillPreview([...fill.points])
  }, [])

  const handleFillEnd = useCallback((point: CanvasPoint) => {
    const fill = fillRef.current
    fillRef.current = null
    setFillPreview(null)
    if (!fill) return

    const lastPoint = fill.points[fill.points.length - 1]
    if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 1 / cameraRef.current.zoom) {
      fill.points.push(point)
    }
    if (fill.points.length < 3) return

    let doubledArea = 0
    for (let index = 0; index < fill.points.length; index++) {
      const current = fill.points[index]
      const next = fill.points[(index + 1) % fill.points.length]
      doubledArea += current.x * next.y - next.x * current.y
    }
    if (Math.abs(doubledArea) < 4 / (cameraRef.current.zoom * cameraRef.current.zoom)) return

    addStroke({
      id: crypto.randomUUID(),
      pathData: getClosedPathData(fill.points),
      points: fill.points.map((point) => ({ ...point, pressure: 0.5 })),
      color: fill.color,
      width: 0,
      opacity: fill.opacity,
      tool: "fill",
      layerId: fill.layerId,
      timestamp: Date.now(),
    })
  }, [addStroke])

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
    onNudgeStart: handleNudgeStart,
    onNudgeMove: handleNudgeMove,
    onNudgeEnd: handleNudgeEnd,
    onRotateMove: (dx) => {
      const camera = {
        ...cameraRef.current,
        rotation: cameraRef.current.rotation + dx * 0.35,
      }
      cameraRef.current = camera
      setCamera(camera)
    },
    onFillStart: handleFillStart,
    onFillMove: handleFillMove,
    onFillEnd: handleFillEnd,
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
      : ui.activeTool === "select" || hasToolFunction(ui.activeTool, "select") || hasToolFunction(ui.activeTool, "marquee") || hasToolFunction(ui.activeTool, "nudge")
        ? "cursor-default"
        : "cursor-crosshair"
  const viewportCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const cameraTransform = `translate(${viewportCenter.x}, ${viewportCenter.y}) rotate(${ui.camera.rotation}) translate(${-viewportCenter.x}, ${-viewportCenter.y}) translate(${ui.camera.x}, ${ui.camera.y}) scale(${ui.camera.zoom})`

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
        <g transform={cameraTransform}>
          <Grid camera={ui.camera} />
          <Renderer />
          {fillPreview && fillPreview.length > 1 && (
            <path
              d={getClosedPathData(fillPreview)}
              fill={ui.activeColor}
              fillOpacity={Math.min(ui.activeOpacity, 0.3)}
              stroke={ui.activeColor}
              strokeWidth={1 / ui.camera.zoom}
              strokeLinejoin="round"
            />
          )}
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
            <g transform={cameraTransform} stroke="#475569" strokeWidth={0.5 / ui.camera.zoom} opacity={0.35}>
              <line x1={textDraft.x} y1={-500000} x2={textDraft.x} y2={500000} />
              <line x1={textDraft.x + textDraft.width} y1={-500000} x2={textDraft.x + textDraft.width} y2={500000} />
              <line x1={-500000} y1={textDraft.y} x2={500000} y2={textDraft.y} />
              <line x1={-500000} y1={textDraft.y + textDraft.height} x2={500000} y2={textDraft.y + textDraft.height} />
            </g>
          </svg>
          <textarea
            ref={textAreaRef}
            value={textDraft.text}
            wrap="off"
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              const element = event.currentTarget
              const current = textDraftRef.current
              if (!current) return
              setTextDraftState({
                ...current,
                text: element.value,
                width: Math.max(TEXT_MIN_WIDTH_PX, element.scrollWidth),
                height: Math.max(TEXT_MIN_HEIGHT_PX, element.scrollHeight),
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
              left: 0,
              top: 0,
              width: textDraft.width,
              height: textDraft.height,
              minWidth: TEXT_MIN_WIDTH_PX,
              minHeight: TEXT_MIN_HEIGHT_PX,
              padding: 0,
              border: "none",
              color: textDraft.color,
              opacity: textDraft.opacity,
              fontFamily: "inherit",
              fontSize: "16px",
              lineHeight: 1.25,
              whiteSpace: "pre",
              transform: `translate(${viewportCenter.x}px, ${viewportCenter.y}px) rotate(${ui.camera.rotation}deg) translate(${-viewportCenter.x}px, ${-viewportCenter.y}px) translate(${ui.camera.x}px, ${ui.camera.y}px) scale(${ui.camera.zoom}) translate(${textDraft.x}px, ${textDraft.y}px)`,
              transformOrigin: "0 0",
            }}
          />
        </>
      )}
    </div>
  )
}
