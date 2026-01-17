import { useCanvasStore } from "../../stores/canvasStore"
import { useMemo } from "react"

export const SpatialIndexStats = () => {
  const spatialIndex = useCanvasStore((state) => state.spatialIndex)
  const strokes = useCanvasStore((state) => state.doc.strokes)
  const camera = useCanvasStore((state) => state.ui.camera)
  const queryVisibleStrokes = useCanvasStore((state) => state.queryVisibleStrokes)

  const stats = useMemo(() => {
    const viewport = {
      x: -camera.x / camera.zoom,
      y: -camera.y / camera.zoom,
      width: window.innerWidth / camera.zoom,
      height: window.innerHeight / camera.zoom,
    }

    const visible = queryVisibleStrokes(viewport)
    const total = Object.keys(strokes).length

    return {
      total,
      visible: visible.length,
      culled: total - visible.length,
      cullRate: total > 0 ? (((total - visible.length) / total) * 100).toFixed(1) : 0,
      ...spatialIndex.getStats(),
    }
  }, [spatialIndex, strokes, camera, queryVisibleStrokes])

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono">
      <div className="font-bold mb-2">Spatial Index Stats</div>
      <div>Total Strokes: {stats.total}</div>
      <div>Visible: {stats.visible}</div>
      <div>Culled: {stats.culled}</div>
      <div>Cull Rate: {stats.cullRate}%</div>
      <div>Indexed: {stats.totalItems}</div>
    </div>
  )
}
