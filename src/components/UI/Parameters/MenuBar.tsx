import { Stack, DotsNine, SquaresFour, IconContext } from "phosphor-react"
import { useCanvasStore } from "../../../stores/canvasStore"

const MenuBar = () => {
  const showLayersPanel = useCanvasStore((state) => state.ui.showLayersPanel)
  const showPrecisionPanel = useCanvasStore((state) => state.ui.showPrecisionPanel)
  const toggleLayersPanel = useCanvasStore((state) => state.toggleLayersPanel)
  const togglePrecisionPanel = useCanvasStore((state) => state.togglePrecisionPanel)

  return (
    <div className="flex flex-row fixed top-0 left-0">
      <IconContext.Provider
        value={{
          size: 36,
          weight: "fill",
          className: "block w-fit p-2 rounded cursor-pointer",
        }}
      >
        <SquaresFour />
        <input placeholder="FileName" className="outline-none" />
        <Stack onClick={() => toggleLayersPanel(!showLayersPanel)} />
        <DotsNine onClick={() => togglePrecisionPanel(!showPrecisionPanel)} />
      </IconContext.Provider>
    </div>
  )
}

export default MenuBar
