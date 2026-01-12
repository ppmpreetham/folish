export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  points: Point[]
  color: string
  width: number
  layerId:  string
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
  layers:  Layer[]
  strokes: Record<string, Stroke> // id -> stroke
  camera: Camera
  activeLayerId: string
  activeTool: Tool
  activeColor: string
  activeWidth:  number
}

export type Tool = 'pen' | 'eraser' | 'pan' | 'select'

export interface SelectionBox {
  x: number
  y: number
  width: number
  height: number
}