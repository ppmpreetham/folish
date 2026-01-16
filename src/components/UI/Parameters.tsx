import { DownloadSimple, UploadSimple, GearSix, Info, IconContext } from "phosphor-react"
import { FC, useState } from "react"
import ZoomRot from "./Parameters/ZoomRot"
import Import from "./Parameters/Import"
import { useCanvasStore } from "../../stores/canvasStore"
import { clsx } from "clsx"

const Parameters: FC<{ className?: string }> = ({ className }) => {
  const camera = useCanvasStore((s) => s.ui.camera)
  const setCamera = useCanvasStore((s) => s.setCamera)

  const [zoomLock, setZoomLock] = useState(false)
  const [rotLock, setRotLock] = useState(false)
  const [showZoomRot, setShowZoomRot] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const setZoomPercent = (z: number) => {
    if (zoomLock) return
    setCamera({ ...camera, zoom: z / 100 })
  }

  const setRotationDeg = (r: number) => {
    if (rotLock) return
    setCamera({ ...camera, rotation: r })
  }

  return (
    <div className={clsx("fixed top-0 right-0 flex", className)}>
      <IconContext.Provider
        value={{
          size: 40,
          weight: "fill",
          className: "block p-2 rounded cursor-pointer hover:bg-gray-200",
        }}
      >
        <div
          className="block w-fit h-fit p-2 rounded cursor-pointer hover:bg-gray-200"
          onClick={() => setShowZoomRot(!showZoomRot)}
        >
          {Math.round(camera.zoom * 100)}%
        </div>
        <div
          className="block w-fit h-fit p-2 rounded cursor-pointer hover:bg-gray-200"
          onClick={() => setShowZoomRot(!showZoomRot)}
        >
          {camera.rotation}°
        </div>
        <div onClick={() => setShowImport(!showImport)}>
          <DownloadSimple />
        </div>
        <UploadSimple />
        <GearSix />
        <Info />
      </IconContext.Provider>

      {showZoomRot && (
        <div className="absolute top-12 right-0">
          <ZoomRot
            zoom={Math.round(camera.zoom * 100)}
            rotation={camera.rotation}
            zoomLock={zoomLock}
            rotLock={rotLock}
            onZoomChange={setZoomPercent}
            onRotationChange={setRotationDeg}
            onToggleZoomLock={() => setZoomLock((v) => !v)}
            onToggleRotLock={() => setRotLock((v) => !v)}
          />
        </div>
      )}

      {showImport && (
        <div className="absolute top-12 right-0">
          <Import />
        </div>
      )}
    </div>
  )
}

export default Parameters
