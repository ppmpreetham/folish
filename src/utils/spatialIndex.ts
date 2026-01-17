import RBush from "rbush"
import { Bounds, Stroke } from "../types"

export interface RBushItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
}

export class SpatialIndex {
  private tree: RBush<RBushItem>
  private itemMap: Map<string, RBushItem>

  constructor() {
    this.tree = new RBush<RBushItem>()
    this.itemMap = new Map()
  }

  /**
   * Convert Bounds to RBush format
   */
  private boundsToRBush(id: string, bounds: Bounds): RBushItem {
    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
      id,
    }
  }

  /**
   * Build index from scratch (bulk loading is faster)
   */
  buildFromStrokes(strokes: Record<string, Stroke>): void {
    const items: RBushItem[] = []

    for (const [id, stroke] of Object.entries(strokes)) {
      if (stroke.bounds) {
        const item = this.boundsToRBush(id, stroke.bounds)
        items.push(item)
        this.itemMap.set(id, item)
      }
    }

    this.tree.clear()
    if (items.length > 0) {
      this.tree.load(items)
    }
  }

  /**
   * Insert a single stroke (when drawing completes)
   */
  insert(id: string, bounds: Bounds): void {
    const item = this.boundsToRBush(id, bounds)
    this.tree.insert(item)
    this.itemMap.set(id, item)
  }

  /**
   * Remove a stroke (when deleted)
   */
  remove(id: string): void {
    const item = this.itemMap.get(id)
    if (item) {
      this.tree.remove(item)
      this.itemMap.delete(id)
    }
  }

  /**
   * Remove multiple strokes efficiently
   */
  removeBatch(ids: string[]): void {
    ids.forEach((id) => this.remove(id))
  }

  /**
   * Query visible strokes in viewport
   * Returns array of stroke IDs
   */
  query(viewport: Bounds): string[] {
    const results = this.tree.search({
      minX: viewport.x,
      minY: viewport.y,
      maxX: viewport.x + viewport.width,
      maxY: viewport.y + viewport.height,
    })

    return results.map((item) => item.id)
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      totalItems: this.itemMap.size,
      treeDepth: (this.tree as any)._maxEntries || "N/A",
    }
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.tree.clear()
    this.itemMap.clear()
  }
}
