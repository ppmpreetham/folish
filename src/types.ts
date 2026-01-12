export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  points: Point[]
  pathData?: string
  pressure: number[]
  layerId: string
  color: string
  width: number
  opacity: number
  tool: Tool
  timestamp: number
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  strokeIds: string[]
}

export interface Camera {
  x: number
  y: number
  zoom: number
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
}
