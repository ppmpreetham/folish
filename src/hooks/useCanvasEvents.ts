import { useCallback, useEffect, useRef } from "react"
import { Point, Tool, Camera } from "../types"
import { useCanvasMath } from "./useCanvasMath"
import { hasToolFunction } from "../utils/toolsData"

type CanvasPoint = Pick<Point, "x" | "y">

interface UseCanvasEventsProps {
  cameraRef: React.RefObject<Camera>
  rectRef: React.RefObject<DOMRect | null>
  activeTool: Tool
  onStrokeStart: (point: Point & { pressure: number; pointerType: string }) => void
  onStrokeMove: (point: Point & { pressure: number; pointerType: string }) => void
  onStrokeEnd: () => void
  onPanMove: (dx: number, dy: number) => void
  onZoom: (camera: Camera) => void
  onSelectionStart?: (
    point: CanvasPoint,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => void
  onSelectionMove?: (
    point: CanvasPoint,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => void
  onSelectionEnd?: (
    point: CanvasPoint,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  ) => void
  onTextStart?: (point: CanvasPoint) => void
  onNudgeStart?: (point: CanvasPoint) => void
  onNudgeMove?: (point: CanvasPoint) => void
  onNudgeEnd?: (point: CanvasPoint) => void
  onRotateMove?: (dx: number, dy: number) => void
  onFillStart?: (point: CanvasPoint) => void
  onFillMove?: (point: CanvasPoint) => void
  onFillEnd?: (point: CanvasPoint) => void
}

export const useCanvasEvents = (props: UseCanvasEventsProps) => {
  const { toWorld, calculateZoom } = useCanvasMath(props)
  const propsRef = useRef(props)
  propsRef.current = props
  const isDrawingRef = useRef(false)
  const isPanningRef = useRef(false)
  const isSelectingRef = useRef(false)
  const isFillingRef = useRef(false)
  const isNudgingRef = useRef(false)
  const isRotatingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const current = propsRef.current
      const isPan = current.activeTool === "pan" || e.button === 1 || e.ctrlKey || e.metaKey

      e.currentTarget.setPointerCapture(e.pointerId)
      lastPosRef.current = { x: e.clientX, y: e.clientY }

      if (isPan) {
        isPanningRef.current = true
      } else if (hasToolFunction(current.activeTool, "rotate")) {
        isRotatingRef.current = true
      } else if (current.activeTool === "fill") {
        isFillingRef.current = true
        current.onFillStart?.(toWorld(e.clientX, e.clientY))
      } else if (hasToolFunction(current.activeTool, "text")) {
        current.onTextStart?.(toWorld(e.clientX, e.clientY))
      } else if (hasToolFunction(current.activeTool, "nudge")) {
        isNudgingRef.current = true
        current.onNudgeStart?.(toWorld(e.clientX, e.clientY))
      } else if (
        current.activeTool === "select" ||
        hasToolFunction(current.activeTool, "select") ||
        hasToolFunction(current.activeTool, "marquee")
      ) {
        isSelectingRef.current = true
        current.onSelectionStart?.(toWorld(e.clientX, e.clientY), {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        })
      } else if (current.activeTool === "pen" || current.activeTool === "eraser") {
        isDrawingRef.current = true
        current.onStrokeStart({
          ...toWorld(e.clientX, e.clientY),
          pressure: e.pressure,
          pointerType: e.pointerType,
        })
      }
    },
    [toWorld]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      const current = propsRef.current
      const isTrackpad = Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) < 50

      if (isTrackpad && !e.ctrlKey) {
        const PAN_MULTIPLIER = 2.5
        current.onPanMove(e.deltaX * PAN_MULTIPLIER, e.deltaY * PAN_MULTIPLIER)
        return
      }

      const ZOOM_MULTIPLIER = isTrackpad ? 10 : 1.0
      const newCamera = calculateZoom(e.deltaY * ZOOM_MULTIPLIER, e.clientX, e.clientY)
      current.onZoom(newCamera)
    },
    [calculateZoom]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (rafRef.current) return

      const x = e.clientX
      const y = e.clientY
      const pressure = e.pressure
      const pointerType = e.pointerType

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined
        const current = propsRef.current

        if (isPanningRef.current) {
          const dx = x - lastPosRef.current.x
          const dy = y - lastPosRef.current.y
          lastPosRef.current = { x, y }
          current.onPanMove(dx, dy)
        } else if (isRotatingRef.current) {
          const dx = x - lastPosRef.current.x
          const dy = y - lastPosRef.current.y
          lastPosRef.current = { x, y }
          current.onRotateMove?.(dx, dy)
        } else if (isFillingRef.current) {
          current.onFillMove?.(toWorld(x, y))
        } else if (isNudgingRef.current) {
          current.onNudgeMove?.(toWorld(x, y))
        } else if (isSelectingRef.current) {
          current.onSelectionMove?.(toWorld(x, y), {
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
          })
        } else if (isDrawingRef.current) {
          current.onStrokeMove({
            ...toWorld(x, y),
            pressure,
            pointerType,
          })
        }
      })
    },
    [toWorld]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const current = propsRef.current
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (isPanningRef.current) isPanningRef.current = false
      if (isRotatingRef.current) isRotatingRef.current = false
      if (isFillingRef.current) {
        isFillingRef.current = false
        current.onFillEnd?.(toWorld(e.clientX, e.clientY))
      }
      if (isNudgingRef.current) {
        isNudgingRef.current = false
        current.onNudgeEnd?.(toWorld(e.clientX, e.clientY))
      }
      if (isSelectingRef.current) {
        isSelectingRef.current = false
        current.onSelectionEnd?.(toWorld(e.clientX, e.clientY), {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        })
      }
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        current.onStrokeEnd()
      }
    },
    [toWorld]
  )

  return { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel }
}
