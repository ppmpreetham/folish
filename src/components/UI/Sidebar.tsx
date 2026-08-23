import {
  ScribbleLoop as ScribbleLoopIcon,
  Gradient as GradientIcon,
  CircleHalf as CircleHalfIcon,
  ArrowCounterClockwise as ArrowCounterClockwiseIcon,
  X as XIcon,
} from "phosphor-react"
import { useCanvasStore } from "../../stores/canvasStore"

const SideBar = () => {
  const setSidebarOpen = useCanvasStore((state) => state.setSidebarOpen)
  const editingOption = useCanvasStore((state) => state.ui.editingOption)

  return (
    <div
      id="sidebar-container"
      className="fixed top-0 right-0 h-full w-80 bg-[#111827] shadow-2xl border-l border-gray-700 p-6 z-100 text-white flex flex-col animate-in slide-in-from-right duration-300 pointer-events-auto"
    >
      <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h2 className="text-xl font-bold">{editingOption !== null ? editingOption + 1 : ""}</h2>
        <button
          onClick={() => setSidebarOpen(false)}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800"
        >
          <XIcon size={24} />
        </button>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto">
        {/* Basics Category */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Basics</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl text-sm font-semibold transition-colors flex flex-col items-center gap-2 border border-gray-700 hover:border-gray-500">
              <GradientIcon size={24} weight="duotone" />
              Size
            </button>
            <button className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl text-sm font-semibold transition-colors flex flex-col items-center gap-2 border border-gray-700 hover:border-gray-500">
              <CircleHalfIcon size={24} weight="duotone" />
              Opacity
            </button>
          </div>
        </div>

        {/* Tools Category */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Tools</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl text-sm font-semibold transition-colors flex flex-col items-center gap-2 border border-gray-700 hover:border-gray-500">
              <ScribbleLoopIcon size={24} weight="duotone" />
              Smooth
            </button>
            <button className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl text-sm font-semibold transition-colors flex flex-col items-center gap-2 border border-gray-700 hover:border-gray-500">
              <ArrowCounterClockwiseIcon size={24} weight="duotone" />
              Undo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SideBar
