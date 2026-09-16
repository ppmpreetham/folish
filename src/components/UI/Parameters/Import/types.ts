import { Camera } from "../../../../types"

export interface ImportModalProps {
  onClose: () => void
}

/**
 * Calculates world coordinates for centering an imported image in the current viewport.
 */
export function calculateCenteredImagePosition(
  camera: Camera,
  imgWidth: number,
  imgHeight: number,
  maxViewportRatio: number = 0.5
): { x: number; y: number; width: number; height: number } {
  const screenW = window.innerWidth
  const screenH = window.innerHeight

  // World dimensions of screen
  const worldViewportW = screenW / camera.zoom
  const worldViewportH = screenH / camera.zoom

  let targetW = imgWidth
  let targetH = imgHeight

  const maxW = worldViewportW * maxViewportRatio
  const maxH = worldViewportH * maxViewportRatio

  if (targetW > maxW || targetH > maxH) {
    const ratio = Math.min(maxW / targetW, maxH / targetH)
    targetW = Math.round(targetW * ratio)
    targetH = Math.round(targetH * ratio)
  }

  // World center point of current view
  const worldCenterX = (screenW / 2 - camera.x) / camera.zoom
  const worldCenterY = (screenH / 2 - camera.y) / camera.zoom

  return {
    x: Math.round(worldCenterX - targetW / 2),
    y: Math.round(worldCenterY - targetH / 2),
    width: targetW,
    height: targetH,
  }
}
