import { X as XIcon } from "phosphor-react"
import { useCanvasStore } from "../../stores/canvasStore"
import { BRUSHES, SHAPE_TOOLS, TOOLS } from "../../utils/toolsData"
import type { ShapeKind } from "../../types"

const SideBar = () => {
  const setSidebarOpen = useCanvasStore((state) => state.setSidebarOpen)
  const editingOption = useCanvasStore((state) => state.ui.editingOption)
  const toolSlots = useCanvasStore((state) => state.ui.toolSlots)
  const activeToolId = useCanvasStore((state) => state.ui.activeTool)
  const setSlotAssignment = useCanvasStore((state) => state.setSlotAssignment)
  const setActiveBrush = useCanvasStore((state) => state.setActiveBrush)
  const setActiveTool = useCanvasStore((state) => state.setActiveTool)
  const setActiveShapeKind = useCanvasStore((state) => state.setActiveShapeKind)
  const brushSettings = useCanvasStore((state) => state.ui.brushSettings)

  const currentAssignment = editingOption !== null ? toolSlots[editingOption] : null

  let title = "Properties"
  if (editingOption !== null) {
    if (currentAssignment) {
      if (currentAssignment.type === "brush") {
        title = BRUSHES.find((b) => b.id === currentAssignment.id)?.name || title
      } else {
        title = TOOLS.find((t) => t.id === currentAssignment.id)?.name || title
      }
    } else {
      title = `Editing Slot ${editingOption + 1}`
    }
  }

  const renderContent = () => {
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold uppercase tracking-widest mb-4">Brushes</h3>
          <div className="grid grid-cols-2 gap-3">
            {BRUSHES.map((brush) => {
              const Logo = brush.logo
              const isActive =
                currentAssignment?.type === "brush" && currentAssignment?.id === brush.id
              const brushColor = brushSettings[brush.id]?.color ?? "#ffffff"
              return (
                <button
                  key={brush.id}
                  onClick={() => {
                    if (editingOption !== null) {
                      setSlotAssignment(editingOption, { type: "brush", id: brush.id })
                    }
                    setActiveBrush(brush.id)
                    setActiveTool(brush.id === "fill" ? "fill" : "pen")
                  }}
                  className={`p-4 text-sm font-semibold transition-colors flex flex-col items-center gap-2 border rounded-xl ${
                    isActive
                      ? "bg-gray-800 border-white text-white"
                      : "bg-black border-gray-700 hover:border-gray-500 hover:bg-gray-900 text-gray-300"
                  }`}
                >
                  <Logo size={24} weight={isActive ? "fill" : "duotone"} color={brushColor} />
                  {brush.name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold uppercase tracking-widest mb-4">Shapes</h3>
          <div className="grid grid-cols-2 gap-3">
            {SHAPE_TOOLS.map((tool) => {
              const Logo = tool.logo
              const isActive =
                (currentAssignment?.type === "tool" && currentAssignment?.id === tool.id) ||
                (editingOption === null && tool.id === activeToolId)
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (editingOption !== null) {
                      setSlotAssignment(editingOption, { type: "tool", id: tool.id })
                    }
                    setActiveShapeKind(tool.id as ShapeKind)
                  }}
                  className={`p-4 text-sm font-semibold transition-colors flex flex-col items-center gap-2 border rounded-xl ${
                    isActive
                      ? "bg-gray-800 border-white text-white"
                      : "bg-black border-gray-700 hover:border-gray-500 hover:bg-gray-900 text-gray-300"
                  }`}
                >
                  <Logo size={24} weight={isActive ? "fill" : "duotone"} />
                  {tool.name}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold uppercase tracking-widest mb-4">Tools</h3>
          <div className="grid grid-cols-2 gap-3">
            {TOOLS.map((tool) => {
              const Logo = tool.logo
              const isActive =
                currentAssignment?.type === "tool" && currentAssignment?.id === tool.id
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (editingOption !== null) {
                      setSlotAssignment(editingOption, { type: "tool", id: tool.id })
                    }
                    setActiveTool(tool.id)
                  }}
                  className={`p-4 text-sm font-semibold transition-colors flex flex-col items-center gap-2 border rounded-xl ${
                    isActive
                      ? "bg-gray-800 border-white text-white"
                      : "bg-black border-gray-700 hover:border-gray-500 hover:bg-gray-900 text-gray-300"
                  }`}
                >
                  <Logo size={24} weight={isActive ? "fill" : "duotone"} />
                  {tool.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      id="sidebar-container"
      className="fixed top-0 right-0 h-full w-80 bg-black shadow-2xl border-l border-gray-800 p-6 z-100 text-white flex flex-col animate-in slide-in-from-right duration-300 pointer-events-auto"
    >
      <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <button
          onClick={() => setSidebarOpen(false)}
          className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-900 rounded-full"
        >
          <XIcon size={24} />
        </button>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {renderContent()}
      </div>
    </div>
  )
}

export default SideBar
