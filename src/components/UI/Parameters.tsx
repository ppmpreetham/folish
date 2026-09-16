import { DownloadSimple, UploadSimple, GearSix, Info, IconContext } from "phosphor-react"
import { FC, useState } from "react"
import ZoomRot from "./Parameters/ZoomRot"
import Import from "./Parameters/Import"
import { CanvasSettings } from "./Parameters/CanvasSettings"
import { useCanvasStore } from "../../stores/canvasStore"
import { clsx } from "clsx"

const Parameters: FC<{ className?: string }> = ({ className }) => {
  const camera = useCanvasStore((s) => s.ui.camera)
  const setCamera = useCanvasStore((s) => s.setCamera)
  const showSpatialIndexStats = useCanvasStore((s) => s.ui.showSpatialIndexStats)
  const setSpatialIndexStatsVisible = useCanvasStore((s) => s.setSpatialIndexStatsVisible)
  const showSettings = useCanvasStore((s) => s.ui.showSettings)
  const setShowSettings = useCanvasStore((s) => s.setShowSettings)

  const [zoomLock, setZoomLock] = useState(false)
  const [rotLock, setRotLock] = useState(false)
  const [showZoomRot, setShowZoomRot] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const toggleZoomRot = () => {
    const next = !showZoomRot
    setShowZoomRot(next)
    if (next) {
      setShowImport(false)
      setShowSettings(false)
    }
  }

  const toggleImport = () => {
    const next = !showImport
    setShowImport(next)
    if (next) {
      setShowZoomRot(false)
      setShowSettings(false)
    }
  }

  const toggleSettings = () => {
    const next = !showSettings
    setShowSettings(next)
    if (next) {
      setShowZoomRot(false)
      setShowImport(false)
    }
  }

  const setZoomPercent = (z: number) => {
    if (zoomLock) return
    setCamera({ ...camera, zoom: z / 100 })
  }

  const setRotationDeg = (r: number) => {
    if (rotLock) return
    setCamera({ ...camera, rotation: r })
  }

  return (
    <div className={clsx("fixed top-0 right-0 flex z-30", className)}>
      <IconContext.Provider
        value={{
          size: 40,
          weight: "fill",
          className: "block p-2 rounded cursor-pointer hover:bg-gray-200",
        }}
      >
        <div
          className="block w-fit h-fit p-2 rounded cursor-pointer hover:bg-gray-200"
          onClick={toggleZoomRot}
        >
          {Math.round(camera.zoom * 100)}%
        </div>
        <div
          className="block w-fit h-fit p-2 rounded cursor-pointer hover:bg-gray-200"
          onClick={toggleZoomRot}
        >
          {camera.rotation}°
        </div>
        <div
          className={clsx("rounded", showImport && "bg-gray-200")}
          onClick={toggleImport}
          title="Import"
        >
          <DownloadSimple />
        </div>
        <UploadSimple />
        <div
          className={clsx("rounded", showSettings && "bg-gray-200")}
          onClick={toggleSettings}
          title="Canvas Settings"
        >
          <GearSix />
        </div>
        <div
          className={clsx("rounded", showSpatialIndexStats && "bg-gray-200")}
          onClick={() => setSpatialIndexStatsVisible(!showSpatialIndexStats)}
          title="Toggle spatial index statistics"
        >
          <Info />
        </div>
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
          <Import onClose={() => setShowImport(false)} />
        </div>
      )}

      {showSettings && (
        <div className="absolute top-12 right-0">
          <CanvasSettings onClose={() => setShowSettings(false)} />
        </div>
      )}
    </div>
  )
}

export default Parameters
