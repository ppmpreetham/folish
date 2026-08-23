import { useEffect } from "react"
import { InfiniteCanvas } from "./components/Canvas/InfiniteCanvas"
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return // Let the browser handle undo/redo in text inputs
      }

      const isZ = e.code === "KeyZ" || e.key.toLowerCase() === "z"
      const isY = e.code === "KeyY" || e.key.toLowerCase() === "y"

      if (e.ctrlKey || e.metaKey) {
        if (isZ && !e.shiftKey) {
          console.log("⌨️ Ctrl+Z detected -> Undo")
          e.preventDefault()
          undo()
        } else if ((isZ && e.shiftKey) || (isY && !e.shiftKey)) {
          console.log("⌨️ Ctrl+Shift+Z or Ctrl+Y detected -> Redo")
          e.preventDefault()
          redo()
        }
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
    </div>
  )
}

export default App
