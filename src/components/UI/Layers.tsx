import React from "react"
import { useCanvasStore } from "../../stores/canvasStore"

export const LayersPanel: React.FC = () => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const activeLayerId = useCanvasStore((state) => state.ui.activeLayerId)
  const actions = useCanvasStore()

  const {
    addLayer,
    deleteLayer,
    setActiveLayer,
    toggleLayerVisibility,
    setLayerOpacity,
    renameLayer,
  } = useCanvasStore()

  return (
    <div className="absolute top-4 right-4 w-lg bg-white rounded-xl shadow-lg p-4 space-y-3 border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">Layers</h3>
        <button
          onClick={() => addLayer(`Layer ${layers.length + 1}`)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
        >
          + New
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {[...layers].reverse().map((layer) => (
          <div
            key={layer.id}
            className={`p-3 rounded border-2 transition cursor-pointer ${
              activeLayerId === layer.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => setActiveLayer(layer.id)}
          >
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleLayerVisibility(layer.id)
                }}
                className="text-lg"
              >
                {layer.visible ? "👁️" : "🚫"}
              </button>
              <input
                type="text"
                value={layer.name}
                onChange={(e) => renameLayer(layer.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none"
              />
              {layers.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteLayer(layer.id)
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  🗑️
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={layer.opacity * 100}
                onInput={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value) / 100
                  actions.setLayerOpacityTransient(layer.id, val)
                }}
                onChange={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value) / 100
                  actions.setLayerOpacity(layer.id, val)
                }}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs text-gray-500 w-8">{Math.round(layer.opacity * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
