import React from "react"
import { useCanvasStore } from "../../stores/canvasStore"
import { Tool } from "../../types"

export const Toolbar: React.FC = () => {
  const { activeTool, activeColor, activeWidth } = useCanvasStore((state) => state.ui)

  const { setActiveTool, setActiveColor, setActiveWidth, undo, redo, canUndo, canRedo } =
    useCanvasStore()

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: "pen", icon: "✏️", label: "Pen" },
    { id: "eraser", icon: "🧹", label: "Eraser" },
    { id: "pan", icon: "✋", label: "Pan" },
    { id: "select", icon: "⬚", label: "Select" },
  ]

  const colors = ["#000000", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"]

  const widths = [1, 2, 4, 8]

  return (
    <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg p-3 space-y-3 border border-gray-200">
      {/* Tools */}
      <div className="flex gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`p-2 rounded transition ${
              activeTool === tool.id ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
            title={tool.label}
          >
            <span className="text-lg">{tool.icon}</span>
          </button>
        ))}
      </div>

      {/* Colors */}
      <div className="flex gap-1">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => setActiveColor(color)}
            className={`w-8 h-8 rounded border-2 transition ${
              activeColor === color ? "border-blue-500 scale-110" : "border-gray-300"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Width */}
      <div className="flex gap-1">
        {widths.map((width) => (
          <button
            key={width}
            onClick={() => setActiveWidth(width)}
            className={`w-8 h-8 rounded flex items-center justify-center transition ${
              activeWidth === width ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            <div
              className="rounded-full bg-current"
              style={{ width: width * 2, height: width * 2 }}
            />
          </button>
        ))}
      </div>

      {/* Undo/Redo */}
      <div className="flex gap-1 pt-2 border-t">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex-1 p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex-1 p-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>
    </div>
  )
}
