import {
  Pen,
  PenNib,
  BezierCurve,
  LineSegment,
  Minus,
  PencilSimple,
  Pencil,
  PaintBrush,
  Drop,
  PaintBucket,
  DotsThree,
  Cursor,
  Selection,
  ArrowsOut,
  Scissors,
  SquareHalf,
  CircleHalf,
  TextT,
  Hand,
  ArrowClockwise,
  MagnifyingGlass,
  Square,
  Circle,
  Triangle,
  Diamond,
  ArrowUpRight,
  IconProps,
} from "phosphor-react"
import React from "react"

export interface BrushProperties {
  smoothing: number
  thinning: number
  streamline: number
  easing: (t: number) => number
  start: { taper: number; cap: boolean }
  end: { taper: number; cap: boolean }
}

export const DEFAULT_BRUSH: BrushProperties = {
  smoothing: 0.5,
  thinning: 0.5,
  streamline: 0.5,
  easing: (t: number) => t,
  start: { taper: 0, cap: true },
  end: { taper: 0, cap: true },
}

export interface BrushItem {
  id: string
  name: string
  properties: BrushProperties
  logo: React.FC<IconProps>
}

export interface ToolItem {
  id: string
  name: string
  toolFunction: string
  logo: React.FC<IconProps>
}

export const BRUSHES: BrushItem[] = [
  { id: "pen", name: "Pen", properties: { ...DEFAULT_BRUSH, smoothing: 0.45, streamline: 0.45 }, logo: Pen },
  {
    id: "fountain",
    name: "Fountain",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.35, thinning: 0.7, streamline: 0.65 },
    logo: PenNib,
  },
  {
    id: "dynamic-pen",
    name: "Dynamic Pen",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.4, thinning: 0.6, streamline: 0.8 },
    logo: BezierCurve,
  },
  {
    id: "fixed-width",
    name: "Fixed Width",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.25, thinning: 0, streamline: 0.35 },
    logo: LineSegment,
  },
  {
    id: "wire",
    name: "Wire",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.1, thinning: 0, streamline: 0.15 },
    logo: Minus,
  },
  {
    id: "soft-pencil",
    name: "Soft Pencil",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.8, thinning: 0.25, streamline: 0.55 },
    logo: PencilSimple,
  },
  {
    id: "hard-pencil",
    name: "Hard Pencil",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.2, thinning: 0.35, streamline: 0.25 },
    logo: Pencil,
  },
  {
    id: "marker",
    name: "Marker",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.65, thinning: -0.5, streamline: 0.55, start: { taper: 0, cap: false }, end: { taper: 0, cap: false } },
    logo: PaintBrush,
  },
  {
    id: "watercolor",
    name: "Watercolor",
    properties: { ...DEFAULT_BRUSH, smoothing: 0.9, thinning: 0.15, streamline: 0.7 },
    logo: Drop,
  },
  { id: "airbrush", name: "Airbrush", properties: { ...DEFAULT_BRUSH, smoothing: 0.95, thinning: 0.2, streamline: 0.85 }, logo: Drop },
  { id: "fill", name: "Fill", properties: { ...DEFAULT_BRUSH }, logo: PaintBucket },
  { id: "dotted", name: "Dotted", properties: { ...DEFAULT_BRUSH, smoothing: 0.5, thinning: 0.1, streamline: 0.5 }, logo: DotsThree },
]

const BRUSHES_BY_ID = new Map(BRUSHES.map((brush) => [brush.id, brush]))

export const getBrushProperties = (brushId: string): BrushProperties =>
  BRUSHES_BY_ID.get(brushId)?.properties ?? DEFAULT_BRUSH

export const TOOLS: ToolItem[] = [
  { id: "selection", name: "Selection", toolFunction: "select", logo: Cursor },
  { id: "marquee", name: "Marquee", toolFunction: "marquee", logo: Selection },
  { id: "nudge", name: "Nudge", toolFunction: "nudge", logo: ArrowsOut },
  { id: "slice", name: "Slice", toolFunction: "slice", logo: Scissors },
  { id: "hard-mask", name: "Hard Mask", toolFunction: "hard-mask", logo: SquareHalf },
  { id: "soft-mask", name: "Soft Mask", toolFunction: "soft-mask", logo: CircleHalf },
  { id: "text", name: "Text", toolFunction: "text", logo: TextT },
  { id: "pan", name: "Pan", toolFunction: "pan", logo: Hand },
  { id: "rotate", name: "Rotate", toolFunction: "rotate", logo: ArrowClockwise },
  { id: "zoom", name: "Zoom", toolFunction: "zoom", logo: MagnifyingGlass },
]

export const SHAPE_TOOLS: ToolItem[] = [
  { id: "rect", name: "Rectangle", toolFunction: "shape", logo: Square },
  { id: "ellipse", name: "Ellipse", toolFunction: "shape", logo: Circle },
  { id: "triangle", name: "Triangle", toolFunction: "shape", logo: Triangle },
  { id: "diamond", name: "Diamond", toolFunction: "shape", logo: Diamond },
  { id: "line", name: "Line", toolFunction: "shape", logo: LineSegment },
  { id: "arrow", name: "Arrow", toolFunction: "shape", logo: ArrowUpRight },
]

const SHAPE_TOOL_IDS = new Set(SHAPE_TOOLS.map((tool) => tool.id))

export const isShapeTool = (toolId: string) => SHAPE_TOOL_IDS.has(toolId)

const TOOL_FUNCTIONS_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool.toolFunction]))

export const hasToolFunction = (toolId: string, toolFunction: string) =>
  TOOL_FUNCTIONS_BY_ID.get(toolId) === toolFunction
