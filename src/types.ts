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
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  strokeIds: string[]
  textIds?: string[]
  bounds?: Bounds
}

export interface Camera {
  x: number
  y: number
  zoom: number
  rotation: number
}

export interface CanvasState {
  layers: Layer[]
  strokes: Record<string, Stroke>
  texts: Record<string, TextShape>
}

export type Tool = string;

export interface SelectionLasso {
  points: Array<Pick<Point, "x" | "y">>
}

export interface SlotAssignment {
  type: "brush" | "tool"
  id: string
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
  sidebarOpen: boolean
  editingOption: number | null
  activeBrush: string
  activeSmooth: number
  toolSlots: Record<number, SlotAssignment>
  selectedStrokeIds: string[]
  selectionLasso: SelectionLasso | null
  selectionTranslation: { x: number; y: number }
}

export interface SimpleUIState {
  showLayersPanel: boolean
  showPrecisionPanel: boolean
  showParameters: boolean
}
