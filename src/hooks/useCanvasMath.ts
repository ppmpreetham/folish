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

      const radians = (-cam.rotation * Math.PI) / 180
      const cosine = Math.cos(radians)
      const sine = Math.sin(radians)
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const x = screenX - rect.left - centerX
      const y = screenY - rect.top - centerY
      const unrotatedX = x * cosine - y * sine + centerX
      const unrotatedY = x * sine + y * cosine + centerY

      return {
        x: (unrotatedX - cam.x) / cam.zoom,
        y: (unrotatedY - cam.y) / cam.zoom,
      }
    },
    [cameraRef, rectRef]
  )

  const toScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      const cam = cameraRef.current
      const rect = rectRef.current
      if (!rect || !cam) return { x: 0, y: 0 }

      const radians = (cam.rotation * Math.PI) / 180
      const cosine = Math.cos(radians)
      const sine = Math.sin(radians)
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const x = cam.x + worldX * cam.zoom - centerX
      const y = cam.y + worldY * cam.zoom - centerY

      return {
        x: x * cosine - y * sine + centerX + rect.left,
        y: x * sine + y * cosine + centerY + rect.top,
      }
    },
    [cameraRef, rectRef]
  )

  const calculateZoom = useCallback(
    (deltaY: number, mouseX: number, mouseY: number): Camera => {
      const cam = cameraRef.current
      const rect = rectRef.current

      if (!rect || !cam) return { x: 0, y: 0, zoom: 1, rotation: 0 }

      const radians = (-cam.rotation * Math.PI) / 180
      const cosine = Math.cos(radians)
      const sine = Math.sin(radians)
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const pointerX = mouseX - rect.left - centerX
      const pointerY = mouseY - rect.top - centerY
      const unrotatedX = pointerX * cosine - pointerY * sine + centerX
      const unrotatedY = pointerX * sine + pointerY * cosine + centerY
      const worldX = (unrotatedX - cam.x) / cam.zoom
      const worldY = (unrotatedY - cam.y) / cam.zoom

      const zoomDelta = -deltaY * ZOOM_SENSITIVITY
      const newZoom = Math.min(Math.max(cam.zoom * Math.exp(zoomDelta), MIN_ZOOM), MAX_ZOOM)

      return {
        zoom: newZoom,
        x: unrotatedX - worldX * newZoom,
        y: unrotatedY - worldY * newZoom,
        rotation: cam.rotation,
      }
    },
    [cameraRef, rectRef]
  )

  const getVisibleBounds = useCallback(() => {
    const rect = rectRef.current
    if (!rect) return { x: 0, y: 0, width: 0, height: 0 }

    const corners = [
      toWorld(rect.left, rect.top),
      toWorld(rect.right, rect.top),
      toWorld(rect.right, rect.bottom),
      toWorld(rect.left, rect.bottom),
    ]
    const xs = corners.map((corner) => corner.x)
    const ys = corners.map((corner) => corner.y)

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
  }, [toWorld, rectRef])

  return { toWorld, toScreen, calculateZoom, getVisibleBounds }
}
