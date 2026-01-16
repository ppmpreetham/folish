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
  pathData?: string
  layerId: string
  color: string
  width: number
  opacity: number
  tool: Tool
  timestamp: number
  bounds?: Bounds
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  strokeIds: string[]
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
  strokes: Record<string, Stroke> // id -> stroke
}

export type Tool = "pen" | "eraser" | "pan" | "select"

export interface SelectionBox {
  x: number
  y: number
  width: number
  height: number
}

export interface UIState {
  camera: Camera
  activeTool: Tool
  activeColor: string
  activeOpacity: number
  activeWidth: number
  activeLayerId: string
  showLayersPanel?: boolean
  showPrecisionPanel?: boolean
}

export interface SimpleUIState {
  showLayersPanel: boolean
  showPrecisionPanel: boolean
  showParameters: boolean
}
