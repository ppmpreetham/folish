import { useEffect, useState } from "react"
import { InfiniteCanvas } from "./components/Canvas/InfiniteCanvas"
import { Toolbar } from "./components/UI/ToolBar"
import { useCanvasStore } from "./stores/canvasStore"
import ColorPicker from "./components/UI/ColorPicker"
import LayersNew from "./components/UI/LayersNew"
import Parameters from "./components/UI/Parameters"
import MenuBar from "./components/UI/Parameters/MenuBar"

function App() {
  const undo = useCanvasStore((state) => state.undo)
  const redo = useCanvasStore((state) => state.redo)
  const showLayersPanel = useCanvasStore((state) => state.ui.showLayersPanel)
  const showPrecisionPanel = useCanvasStore((state) => state.ui.showPrecisionPanel)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo])

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <ColorPicker />
      {/* <div className="w-screen h-screen bg-black" /> */}
      <InfiniteCanvas />
      {/* <Toolbar /> */}
      <MenuBar />
      <LayersNew className={showLayersPanel ? "" : "hidden"} />
      <Parameters className={showPrecisionPanel ? "" : "hidden"} />

      {/* Info Overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-sm text-gray-600">
        <p>
          <strong>Scroll: </strong> Zoom | <strong>Cmd+Drag:</strong> Pan | <strong>Drag:</strong>{" "}
          Draw
        </p>
      </div>
    </div>
  )
}

export default App
