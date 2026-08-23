import { useEffect } from "react"
import { InfiniteCanvas } from "./components/Canvas/InfiniteCanvas"
import { useCanvasStore } from "./stores/canvasStore"
import ColorPicker from "./components/UI/ColorPicker"
import LayersNew from "./components/UI/LayersNew"
import Parameters from "./components/UI/Parameters"
import MenuBar from "./components/UI/Parameters/MenuBar"
import { hasToolFunction } from "./utils/toolsData"

function App() {
  const undo = useCanvasStore((state) => state.undo)
  const redo = useCanvasStore((state) => state.redo)
  const deleteStrokes = useCanvasStore((state) => state.deleteStrokes)
  const setSelectedStrokes = useCanvasStore((state) => state.setSelectedStrokes)
  const translateStrokes = useCanvasStore((state) => state.translateStrokes)
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
      const { selectedStrokeIds, activeTool } = useCanvasStore.getState().ui

      if (hasToolFunction(activeTool, "nudge") && selectedStrokeIds.length > 0) {
        const step = e.shiftKey ? 10 : 1
        const delta =
          e.key === "ArrowLeft"
            ? { x: -step, y: 0 }
            : e.key === "ArrowRight"
              ? { x: step, y: 0 }
              : e.key === "ArrowUp"
                ? { x: 0, y: -step }
                : e.key === "ArrowDown"
                  ? { x: 0, y: step }
                  : null
        if (delta) {
          e.preventDefault()
          translateStrokes(selectedStrokeIds, delta.x, delta.y)
          return
        }
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedStrokeIds.length > 0) {
        e.preventDefault()
        e.stopImmediatePropagation()
        deleteStrokes(selectedStrokeIds)
        return
      }

      if (e.key === "Escape" && selectedStrokeIds.length > 0) {
        setSelectedStrokes([])
        return
      }

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
  }, [undo, redo, deleteStrokes, setSelectedStrokes, translateStrokes])

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
