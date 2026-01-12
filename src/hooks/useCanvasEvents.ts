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

  // Use PointerEvents for Pressure + Tablet support
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const isPan = props.activeTool === "pan" || e.button === 1 || e.ctrlKey || e.metaKey

      // Capture the pointer so drawing continues outside the browser window
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

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Throttling with requestAnimationFrame (Crucial for 144Hz+ monitors)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      rafRef.current = requestAnimationFrame(() => {
        if (isPanningRef.current) {
          const dx = e.clientX - lastPosRef.current.x
          const dy = e.clientY - lastPosRef.current.y
          lastPosRef.current = { x: e.clientX, y: e.clientY }
          props.onPanMove(dx, dy)
        } else if (isDrawingRef.current) {
          props.onStrokeMove({ ...toWorld(e.clientX, e.clientY), pressure: e.pressure })
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

  return { handlePointerDown, handlePointerMove, handlePointerUp }
}
