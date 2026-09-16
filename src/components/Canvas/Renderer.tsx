import { memo, useMemo } from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { getViewportBounds } from "../../utils/bounds"
import { getSvgSelectionTransform } from "../../utils/selectionTransform"
import type { FillType, ShapeShape } from "../../types"
import {
  getDashArray,
  getLineEndPoints,
  getShapeStrokeWidth,
  getTrianglePath,
  getDiamondPath,
  getArrowHead,
} from "../../utils/shapes"
import { getFontStack, getLineHeight } from "../../utils/textStyle"

const fillToSvg = (fill: FillType): { fill: string; fillOpacity: number } => {
  if (fill === "solid") return { fill: "inherit", fillOpacity: 1 }
  if (fill === "half") return { fill: "inherit", fillOpacity: 0.45 }
  return { fill: "none", fillOpacity: 1 }
}

const ShapeView = ({
  shape,
  isMoving,
  selectionTransform,
  selectionTranslation,
}: {
  shape: ShapeShape
  isMoving: boolean
  selectionTransform?: string
  selectionTranslation: { x: number; y: number }
}) => {
  const strokeWidth = getShapeStrokeWidth(shape)
  const x = (shape.offset?.x ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.x : 0)
  const y = (shape.offset?.y ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.y : 0)
  const rotation = shape.rotation ?? 0
  const centerX = shape.x + shape.width / 2
  const centerY = shape.y + shape.height / 2
  const flipTransform =
    shape.flipX || shape.flipY
      ? `translate(${centerX} ${centerY}) scale(${shape.flipX ? -1 : 1} ${shape.flipY ? -1 : 1}) translate(${-centerX} ${-centerY})`
      : ""
  const shapeTransform =
    [x || y ? `translate(${x} ${y})` : "", rotation ? `rotate(${rotation} ${centerX} ${centerY})` : "", flipTransform]
      .filter(Boolean)
      .join(" ") || undefined
  const dashArray = getDashArray(shape.dash, strokeWidth)
  const { fill, fillOpacity } = fillToSvg(shape.fill)
  const common = {
    stroke: shape.color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: dashArray,
    opacity: shape.opacity,
  }

  let element: React.ReactNode
  if (shape.kind === "rect") {
    const radius = Math.min(shape.width / 2, shape.height / 2, strokeWidth * (shape.size === "xl" ? 3 : 2))
    element = (
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={radius}
        fill={fill === "none" ? "none" : shape.color}
        fillOpacity={fill === "none" ? undefined : fillOpacity}
        {...common}
      />
    )
  } else if (shape.kind === "ellipse") {
    element = (
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={shape.width / 2}
        ry={shape.height / 2}
        fill={fill === "none" ? "none" : shape.color}
        fillOpacity={fill === "none" ? undefined : fillOpacity}
        {...common}
      />
    )
  } else if (shape.kind === "triangle" || shape.kind === "diamond") {
    const d =
      shape.kind === "triangle"
        ? getTrianglePath(shape.x, shape.y, shape.width, shape.height)
        : getDiamondPath(shape.x, shape.y, shape.width, shape.height)
    element = (
      <path
        d={d}
        fill={fill === "none" ? "none" : shape.color}
        fillOpacity={fill === "none" ? undefined : fillOpacity}
        {...common}
      />
    )
  } else {
    const { x1, y1, x2, y2 } = getLineEndPoints(shape)
    element = (
      <>
        <path d={`M ${x1} ${y1} L ${x2} ${y2}`} fill="none" {...common} />
        {shape.kind === "arrow" && (
          <path d={getArrowHead(x1, y1, x2, y2, strokeWidth)} fill={shape.color} stroke="none" opacity={shape.opacity} />
        )}
      </>
    )
  }

  return (
    <g key={shape.id} transform={isMoving && selectionTransform ? selectionTransform : undefined}>
      <g transform={shapeTransform}>{element}</g>
    </g>
  )
}

export const Renderer = memo(({ editingTextId }: { editingTextId?: string }) => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const strokes = useCanvasStore((state) => state.doc.strokes)
  const shapes = useCanvasStore((state) => state.doc.shapes)
  const texts = useCanvasStore((state) => state.doc.texts)
  const images = useCanvasStore((state) => state.doc.images)
  const camera = useCanvasStore((state) => state.ui.camera)
  const selectedStrokeIds = useCanvasStore((state) => state.ui.selectedStrokeIds)
  const selectionTranslation = useCanvasStore((state) => state.ui.selectionTranslation)
  const selectionScale = useCanvasStore((state) => state.ui.selectionScale)
  const selectionRotation = useCanvasStore((state) => state.ui.selectionRotation)
  const selectionTransformOrigin = useCanvasStore((state) => state.ui.selectionTransformOrigin)
  const nudgePreview = useCanvasStore((state) => state.ui.nudgePreview)
  const queryVisibleStrokes = useCanvasStore((state) => state.queryVisibleStrokes)

  const viewport = useMemo(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    return getViewportBounds(camera, { width, height })
  }, [camera.x, camera.y, camera.zoom, camera.rotation])

  const visibleStrokesMap = useMemo(() => {
    return queryVisibleStrokes(viewport)
  }, [viewport, queryVisibleStrokes, strokes, shapes, texts, images])

  const selectedStrokeIdSet = useMemo(() => new Set(selectedStrokeIds), [selectedStrokeIds])
  const selectionTransform = selectionTransformOrigin
    ? getSvgSelectionTransform({
        origin: selectionTransformOrigin,
        translation: selectionTranslation,
        scale: selectionScale,
        rotation: selectionRotation,
      })
    : undefined

  return (
    <>
      {layers.map((layer) => {
        if (!layer.visible) return null

        const layerVisibleIds = visibleStrokesMap[layer.id] || []
        if (layerVisibleIds.length === 0) return null

        const visibleSet = new Set(layerVisibleIds)

        return (
          <g key={layer.id} style={{ opacity: layer.opacity }}>
            {layer.strokeIds.filter((id) => visibleSet.has(id)).map((strokeId) => {
              const stroke = strokes[strokeId]
              if (!stroke) return null

              const isMoving = selectedStrokeIdSet.has(stroke.id)
              const x = (stroke.offset?.x ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.x : 0)
              const y = (stroke.offset?.y ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.y : 0)
              const pathData = nudgePreview?.strokeId === stroke.id ? nudgePreview.pathData : stroke.pathData

              const path = <path d={pathData} fill={stroke.color} opacity={stroke.opacity} strokeWidth={0} transform={x || y ? `translate(${x} ${y})` : undefined} />
              return isMoving && selectionTransform ? <g key={stroke.id} transform={selectionTransform}>{path}</g> : <g key={stroke.id}>{path}</g>
            })}
            {(layer.shapeIds ?? []).filter((id) => visibleSet.has(id)).map((shapeId) => {
              const shape = shapes?.[shapeId]
              if (!shape) return null
              return (
                <ShapeView
                  key={shape.id}
                  shape={shape}
                  isMoving={selectedStrokeIdSet.has(shape.id)}
                  selectionTransform={selectionTransform}
                  selectionTranslation={selectionTranslation}
                />
              )
            })}
            {(layer.textIds ?? []).filter((id) => visibleSet.has(id) && id !== editingTextId).map((textId) => {
              const text = texts[textId]
              if (!text) return null
              const isMoving = selectedStrokeIdSet.has(text.id)
              const x = (text.offset?.x ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.x : 0)
              const y = (text.offset?.y ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.y : 0)
              const textRotation = text.rotation ?? 0
              const fontSize = text.fontSize ?? 24
              const lineHeight = getLineHeight(fontSize)
              const centerX = text.x + text.width / 2
              const centerY = text.y + text.height / 2
              const flipTransform =
                text.flipX || text.flipY
                  ? `translate(${centerX} ${centerY}) scale(${text.flipX ? -1 : 1} ${text.flipY ? -1 : 1}) translate(${-centerX} ${-centerY})`
                  : ""
              const textTransform = [
                x || y ? `translate(${x} ${y})` : "",
                textRotation ? `rotate(${textRotation} ${centerX} ${centerY})` : "",
                flipTransform,
              ].filter(Boolean).join(" ") || undefined
              const anchor = text.textAlign === "center" ? "middle" : text.textAlign === "right" ? "end" : "start"
              const anchorX = text.textAlign === "center" ? text.x + text.width / 2 : text.textAlign === "right" ? text.x + text.width : text.x
              return (
                <g key={text.id} transform={isMoving && selectionTransform ? selectionTransform : undefined}>
                <text
                  x={anchorX}
                  y={text.y}
                  dominantBaseline="text-before-edge"
                  fill={text.color}
                  opacity={text.opacity}
                  fontSize={fontSize}
                  fontWeight={text.bold ? 700 : 500}
                  fontStyle={text.italic ? "italic" : undefined}
                  fontFamily={getFontStack(text.fontFamily)}
                  textAnchor={anchor}
                  transform={textTransform}
                >
                  {text.text.split("\n").map((line, index) => (
                    <tspan key={index} x={anchorX} dy={index === 0 ? 0 : lineHeight}>
                      {line || " "}
                    </tspan>
                  ))}
                </text>
                </g>
              )
            })}
            {(layer.imageIds ?? []).filter((id) => visibleSet.has(id)).map((imgId) => {
              const img = images?.[imgId]
              if (!img) return null
              const isMoving = selectedStrokeIdSet.has(img.id)
              const x = (img.offset?.x ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.x : 0)
              const y = (img.offset?.y ?? 0) + (isMoving && !selectionTransform ? selectionTranslation.y : 0)
              const imgRotation = img.rotation ?? 0
              const centerX = img.x + img.width / 2
              const centerY = img.y + img.height / 2
              const flipTransform =
                img.flipX || img.flipY
                  ? `translate(${centerX} ${centerY}) scale(${img.flipX ? -1 : 1} ${img.flipY ? -1 : 1}) translate(${-centerX} ${-centerY})`
                  : ""
              const imgTransform = [
                x || y ? `translate(${x} ${y})` : "",
                imgRotation ? `rotate(${imgRotation} ${centerX} ${centerY})` : "",
                flipTransform,
              ].filter(Boolean).join(" ") || undefined
              return (
                <g key={img.id} transform={isMoving && selectionTransform ? selectionTransform : undefined}>
                  <image
                    href={img.src}
                    xlinkHref={img.src}
                    x={img.x}
                    y={img.y}
                    width={img.width}
                    height={img.height}
                    opacity={img.opacity}
                    transform={imgTransform}
                  />
                </g>
              )
            })}
          </g>
        )
      })}
    </>
  )
})
