import RBush from "rbush"
import { Bounds, Stroke } from "../types"

export interface RBushItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
  layerId: string
}

export class SpatialIndex {
  private tree: RBush<RBushItem>
  private itemMap: Map<string, RBushItem>

  constructor() {
    this.tree = new RBush<RBushItem>()
    this.itemMap = new Map()
  }

  private boundsToRBush(id: string, layerId: string, bounds: Bounds): RBushItem {
    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
      id,
      layerId,
    }
  }

  buildFromStrokes(strokes: Record<string, Stroke>): void {
    const items: RBushItem[] = []
    for (const [id, stroke] of Object.entries(strokes)) {
      if (stroke.bounds) {
        const item = this.boundsToRBush(id, stroke.layerId, stroke.bounds)
        items.push(item)
        this.itemMap.set(id, item)
      }
    }
    this.tree.clear()
    if (items.length > 0) {
      this.tree.load(items)
    }
  }

  insert(id: string, layerId: string, bounds: Bounds): void {
    const item = this.boundsToRBush(id, layerId, bounds)
    this.tree.insert(item)
    this.itemMap.set(id, item)
  }

  remove(id: string): void {
    const item = this.itemMap.get(id)
    if (item) {
      this.tree.remove(item)
      this.itemMap.delete(id)
    }
  }

  removeBatch(ids: string[]): void {
    ids.forEach((id) => this.remove(id))
  }

  query(viewport: Bounds): Record<string, string[]> {
    const results = this.tree.search({
      minX: viewport.x,
      minY: viewport.y,
      maxX: viewport.x + viewport.width,
      maxY: viewport.y + viewport.height,
    })

    const grouped: Record<string, string[]> = {}

    for (const item of results) {
      const layerId = item.layerId

      if (layerId) {
        if (!grouped[layerId]) grouped[layerId] = []
        grouped[layerId].push(item.id)
      }
    }
    return grouped
  }

  getStats() {
    return {
      totalItems: this.itemMap.size,
      treeDepth: (this.tree as any)._maxEntries || "N/A",
    }
  }

  clear(): void {
    this.tree.clear()
    this.itemMap.clear()
  }
}
