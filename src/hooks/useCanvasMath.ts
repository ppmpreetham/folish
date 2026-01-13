import { RefObject, useCallback } from "react"
import { Camera } from "../types"

const MIN_ZOOM = 0.1
const MAX_ZOOM = 50
const ZOOM_SENSITIVITY = 0.0015

interface UseCanvasMathProps {
  cameraRef: RefObject<Camera>
  rectRef: RefObject<DOMRect | null>
}

export const useCanvasMath = ({ cameraRef, rectRef }: UseCanvasMathProps) => {
  const toWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const cam = cameraRef.current
      const rect = rectRef.current
      if (!rect || !cam) return { x: 0, y: 0 }

      return {
        x: (screenX - rect.left - cam.x) / cam.zoom,
        y: (screenY - rect.top - cam.y) / cam.zoom,
      }
    },
    [cameraRef, rectRef]
  )

  const toScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      const cam = cameraRef.current
      const rect = rectRef.current
      if (!rect || !cam) return { x: 0, y: 0 }

      return {
        x: worldX * cam.zoom + cam.x + rect.left,
        y: worldY * cam.zoom + cam.y + rect.top,
      }
    },
    [cameraRef, rectRef]
  )

  const calculateZoom = useCallback(
    (deltaY: number, mouseX: number, mouseY: number): Camera => {
      const cam = cameraRef.current
      const rect = rectRef.current

      if (!rect || !cam) return { x: 0, y: 0, zoom: 1, rotation: 0 }

      const worldX = (mouseX - rect.left - cam.x) / cam.zoom
      const worldY = (mouseY - rect.top - cam.y) / cam.zoom

      const zoomDelta = -deltaY * ZOOM_SENSITIVITY
      const newZoom = Math.min(Math.max(cam.zoom * Math.exp(zoomDelta), MIN_ZOOM), MAX_ZOOM)

      return {
        zoom: newZoom,
        x: mouseX - rect.left - worldX * newZoom,
        y: mouseY - rect.top - worldY * newZoom,
        rotation: cam.rotation,
      }
    },
    [cameraRef, rectRef]
  )

  const getVisibleBounds = useCallback(() => {
    const rect = rectRef.current
    if (!rect) return { x: 0, y: 0, width: 0, height: 0 }

    const topLeft = toWorld(rect.left, rect.top)
    const bottomRight = toWorld(rect.right, rect.bottom)

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    }
  }, [toWorld, rectRef])

  return { toWorld, toScreen, calculateZoom, getVisibleBounds }
}
