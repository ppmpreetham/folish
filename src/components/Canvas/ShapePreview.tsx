import React from "react"
import type { DashType, FillType, ShapeKind, ShapeSize } from "../../types"
import {
  SHAPE_STROKE_WIDTHS,
  getArrowHead,
  getDashArray,
  getDiamondPath,
  getLineEndPoints,
  getTrianglePath,
} from "../../utils/shapes"

export interface ShapeSvgProps {
  kind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  flipX?: boolean
  flipY?: boolean
  color: string
  fill: FillType
  dash: DashType
  size: ShapeSize
  opacity: number
}

/** Renders a shape from its raw geometry; used for both previews and committed shapes. */
export const shapeToSvg = (shape: ShapeSvgProps): React.ReactNode => {
  const strokeWidth = SHAPE_STROKE_WIDTHS[shape.size]
  const dashArray = getDashArray(shape.dash, strokeWidth)
  const fillOpacity = shape.fill === "half" ? 0.45 : 1
  const fillValue = shape.fill === "none" ? "none" : shape.color
  const common = {
    stroke: shape.color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: dashArray,
    opacity: shape.opacity,
  }

  if (shape.kind === "rect") {
    const radius = Math.min(shape.width / 2, shape.height / 2, strokeWidth * (shape.size === "xl" ? 3 : 2))
    return (
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={radius}
        fill={fillValue}
        fillOpacity={shape.fill === "none" ? undefined : fillOpacity}
        {...common}
      />
    )
  }
  if (shape.kind === "ellipse") {
    return (
      <ellipse
        cx={shape.x + shape.width / 2}
        cy={shape.y + shape.height / 2}
        rx={shape.width / 2}
        ry={shape.height / 2}
        fill={fillValue}
        fillOpacity={shape.fill === "none" ? undefined : fillOpacity}
        {...common}
      />
    )
  }
  if (shape.kind === "triangle" || shape.kind === "diamond") {
    const d =
      shape.kind === "triangle"
        ? getTrianglePath(shape.x, shape.y, shape.width, shape.height)
        : getDiamondPath(shape.x, shape.y, shape.width, shape.height)
    return (
      <path
        d={d}
        fill={fillValue}
        fillOpacity={shape.fill === "none" ? undefined : fillOpacity}
        {...common}
      />
    )
  }

  const { x1, y1, x2, y2 } = getLineEndPoints(shape)
  return (
    <>
      <path d={`M ${x1} ${y1} L ${x2} ${y2}`} fill="none" {...common} />
      {shape.kind === "arrow" && (
        <path d={getArrowHead(x1, y1, x2, y2, strokeWidth)} fill={shape.color} stroke="none" opacity={shape.opacity} />
      )}
    </>
  )
}

export const ShapePreview: React.FC<ShapeSvgProps> = (props) => {
  return <>{shapeToSvg(props)}</>
}
