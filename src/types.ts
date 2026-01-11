export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  layerId: string
  points: Point[]
  color: string
  width: number
}

export interface Camera {
  x: number
  y: number
  zoom: number
}
