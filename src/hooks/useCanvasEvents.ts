import { useCallback, useRef, useEffect } from "react"
import { Point, Tool, Camera } from "../types"
import { useCanvasMath } from "./useCanvasMath"

interface UseCanvasEventsProps {
  cameraRef: React.MutableRefObject<Camera>
  rectRef: React.MutableRefObject<DOMRect | null>
  activeTool: Tool
  onStrokeStart: (point: Point & { pressure: number }) => void
  onStrokeMove: (point: Point & { pressure: number }) => void
  onStrokeEnd: () => void
  onPanMove: (dx: number, dy: number) => void
  onZoom: (camera: Camera) => void
}

export const useCanvasEvents = (props: UseCanvasEventsProps) => {
  const { toWorld, calculateZoom } = useCanvasMath(props)
  const isDrawingRef = useRef(false)
  const isPanningRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | undefined>(undefined)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const isPan = props.activeTool === "pan" || e.button === 1 || e.ctrlKey || e.metaKey

      ;(e.target as Element).setPointerCapture(e.pointerId)
      lastPosRef.current = { x: e.clientX, y: e.clientY }

      if (isPan) {
        isPanningRef.current = true
      } else if (props.activeTool === "pen" || props.activeTool === "eraser") {
        isDrawingRef.current = true
        props.onStrokeStart({ ...toWorld(e.clientX, e.clientY), pressure: e.pressure })
      }
    },
    [props.activeTool, toWorld, props.onStrokeStart]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // e.preventDefault()
      const isTrackpad = Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) < 50

      if (isTrackpad && !e.ctrlKey) {
        const PAN_MULTIPLIER = 2.5
        props.onPanMove(e.deltaX * PAN_MULTIPLIER, e.deltaY * PAN_MULTIPLIER)
        return
      }

      const ZOOM_MULTIPLIER = isTrackpad ? 10 : 1.0
      const newCamera = calculateZoom(e.deltaY * ZOOM_MULTIPLIER, e.clientX, e.clientY)
      props.onZoom(newCamera)
    },
    [calculateZoom, props.onPanMove, props.onZoom]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (rafRef.current) return

      const x = e.clientX
      const y = e.clientY
      const pressure = e.pressure

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined

        if (isPanningRef.current) {
          const dx = x - lastPosRef.current.x
          const dy = y - lastPosRef.current.y
          lastPosRef.current = { x, y }
          props.onPanMove(dx, dy)
        } else if (isDrawingRef.current) {
          props.onStrokeMove({ ...toWorld(x, y), pressure })
        }
      })
    },
    [toWorld, props]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
      if (isPanningRef.current) isPanningRef.current = false
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        props.onStrokeEnd()
      }
    },
    [props.onStrokeEnd]
  )

  return { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel }
}
