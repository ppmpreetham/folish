export type TransformPoint = { x: number; y: number }

export type SelectionTransform = {
  origin: TransformPoint
  translation: TransformPoint
  scale: TransformPoint
  rotation: number
}

export const getSvgSelectionTransform = ({ origin, translation, scale, rotation }: SelectionTransform) =>
  `translate(${translation.x} ${translation.y}) rotate(${rotation} ${origin.x} ${origin.y}) translate(${origin.x} ${origin.y}) scale(${scale.x} ${scale.y}) translate(${-origin.x} ${-origin.y})`

export const transformSelectionPoint = (
  point: TransformPoint,
  { origin, translation, scale, rotation }: SelectionTransform,
): TransformPoint => {
  const scaledX = (point.x - origin.x) * scale.x
  const scaledY = (point.y - origin.y) * scale.y
  const radians = (rotation * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    x: origin.x + scaledX * cosine - scaledY * sine + translation.x,
    y: origin.y + scaledX * sine + scaledY * cosine + translation.y,
  }
}
