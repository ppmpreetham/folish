export interface Point {
  x: number
  y: number
  pressure: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export type ShapeKind = "rect" | "ellipse" | "triangle" | "diamond" | "line" | "arrow"
export type DashType = "solid" | "dashed" | "dotted"
export type FillType = "none" | "half" | "solid"
export type ShapeSize = "s" | "m" | "l" | "xl"
export type FontFamilyId = "draw" | "sans" | "serif" | "mono"
export type TextAlign = "left" | "center" | "right"

export interface Stroke {
  id: string
  points: Point[]
  pointsCompressed?: string
  pathData?: string
  layerId: string
  color: string
  width: number
  opacity: number
  tool: Tool
  timestamp: number
  bounds?: Bounds
  offset?: { x: number; y: number }
}

export interface TextShape {
  id: string
  layerId: string
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  opacity: number
  timestamp: number
  bounds: Bounds
  offset?: { x: number; y: number }
  rotation?: number
  fontSize?: number
  fontFamily?: FontFamilyId
  textAlign?: TextAlign
  bold?: boolean
  italic?: boolean
  flipX?: boolean
  flipY?: boolean
}

export interface ShapeShape {
  id: string
  layerId: string
  kind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  color: string
  fill: FillType
  dash: DashType
  size: ShapeSize
  opacity: number
  timestamp: number
  bounds: Bounds
  offset?: { x: number; y: number }
  rotation?: number
  /** For line/arrow: start corner is top-right (flipX) / bottom-left (flipY) instead of top-left. */
  flipX?: boolean
  flipY?: boolean
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  strokeIds: string[]
  shapeIds?: string[]
  textIds?: string[]
  imageIds?: string[]
  bounds?: Bounds
}

export interface Camera {
  x: number
  y: number
  zoom: number
  rotation: number
}

export interface ImageShape {
  id: string
  layerId: string
  x: number
  y: number
  width: number
  height: number
  src: string
  opacity: number
  timestamp: number
  bounds: Bounds
  offset?: { x: number; y: number }
  rotation?: number
  flipX?: boolean
  flipY?: boolean
}

export interface CanvasState {
  layers: Layer[]
  strokes: Record<string, Stroke>
  shapes: Record<string, ShapeShape>
  texts: Record<string, TextShape>
  images: Record<string, ImageShape>
}

/** Metadata embedded in every .flsh file; mirrors FileMeta in src-tauri/src/types.rs */
export interface FileMeta {
  description?: string | null
  createdAt?: number | null
  tags?: string[] | null
  appVersion?: string | null
  thumbnail?: string | null
}

export type Tool = string;

export enum GridType {
  None = "none",
  Dot = "dot",
  Graph = "graph",
  LinedHorizontal = "lined-horizontal",
  LinedVertical = "lined-vertical",
  Isometric = "isometric",
  Triangle = "triangle",
  OnePoint = "1-point",
  TwoPoint = "2-point",
  ThreePoint = "3-point",
}

export enum CanvasBackgroundType {
  Custom = "custom",
  White = "white",
  Transparent = "transparent",
  Brown = "brown",
  Blueprint = "blueprint",
  Darkprint = "darkprint",
  Crumpled = "crumpled",
}

export interface CanvasBackground {
  type: CanvasBackgroundType
  color: string
}

export interface SelectionLasso {
  points: Array<Pick<Point, "x" | "y">>
}

export interface SlotAssignment {
  type: "brush" | "tool"
  id: string
}

export interface BrushSettings {
  color: string
  width: number
  opacity: number
  smooth: number
}

export interface ContextMenuState {
  screen: { x: number; y: number }
  world: { x: number; y: number }
}

export interface UIState {
  camera: Camera
  activeTool: Tool
  activeColor: string
  activeOpacity: number
  activeWidth: number
  activeLayerId: string
  showLayersPanel: boolean
  showPrecisionPanel: boolean
  showSpatialIndexStats: boolean
  showSettings: boolean
  sidebarOpen: boolean
  editingOption: number | null
  activeBrush: string
  activeSmooth: number
  brushSettings: Record<string, BrushSettings>
  canvasBackground: CanvasBackground
  gridType: GridType
  colorPickerOpen: boolean
  colorPickerTarget: "brush" | "canvasBackground"
  toolSlots: Record<number, SlotAssignment>
  selectedStrokeIds: string[]
  selectionLasso: SelectionLasso | null
  selectionMarquee: Bounds | null
  selectionTranslation: { x: number; y: number }
  selectionScale: { x: number; y: number }
  selectionRotation: number
  selectionTransformOrigin: Pick<Point, "x" | "y"> | null
  nudgePreview: { strokeId: string; pathData: string } | null
  // tldraw-style styles for new shapes + selection styling
  activeShapeKind: ShapeKind
  activeDash: DashType
  activeFill: FillType
  activeShapeSize: ShapeSize
  activeFontSize: number
  activeFontFamily: FontFamilyId
  activeTextAlign: TextAlign
  snapToGrid: boolean
  contextMenu: ContextMenuState | null
}

export interface SimpleUIState {
  activeTool: Tool
  activeColor: string
  activeOpacity: number
  activeWidth: number
  activeLayerId: string
  activeBrush: string
  activeSmooth: number
  toolSlots: Record<number, SlotAssignment>
}

export type ClipboardEntry =
  | { kind: "stroke"; stroke: Stroke }
  | { kind: "shape"; shape: ShapeShape }
  | { kind: "text"; text: TextShape }
  | { kind: "image"; image: ImageShape }
