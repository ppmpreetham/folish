import { useCallback } from "react"
import { Camera, Point } from "../types"

interface UseCanvasMathProps {
  cameraRef: React.MutableRefObject<Camera>
  rectRef: React.MutableRefObject<DOMRect | null>
}

export const useCanvasMath = ({ cameraRef, rectRef }: UseCanvasMathProps) => {
  const toWorld = useCallback(
    (screenX: number, screenY: number): Point => {
      const cam = cameraRef.current
      const rect = rectRef.current
      if (!rect) return { x: 0, y: 0 }

      return {
        x: (screenX - rect.left - cam.x) / cam.zoom,
        y: (screenY - rect.top - cam.y) / cam.zoom,
      }
    },
    [cameraRef, rectRef]
  )

  const toScreen = useCallback(
    (worldX: number, worldY: number): Point => {
      const cam = cameraRef.current
      const rect = rectRef.current
      if (!rect) return { x: 0, y: 0 }

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
      if (!rect) return cam

      const scaleFactor = deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(cam.zoom * scaleFactor, 0.05), 50)

      // World point under mouse remains stable
      const worldX = (mouseX - rect.left - cam.x) / cam.zoom
      const worldY = (mouseY - rect.top - cam.y) / cam.zoom

      return {
        zoom: newZoom,
        x: mouseX - rect.left - worldX * newZoom,
        y: mouseY - rect.top - worldY * newZoom,
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
