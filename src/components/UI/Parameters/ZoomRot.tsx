import { MagnifyingGlass, LockSimple, LockSimpleOpen, ArrowCounterClockwise } from "phosphor-react"

interface ZoomRotProps {
  zoom: number // percent
  rotation: number
  zoomLock: boolean
  rotLock: boolean
  onZoomChange: (z: number) => void
  onRotationChange: (r: number) => void
  onToggleZoomLock: () => void
  onToggleRotLock: () => void
}

const ZoomRot = ({
  zoom,
  rotation,
  zoomLock,
  rotLock,
  onZoomChange,
  onRotationChange,
  onToggleZoomLock,
  onToggleRotLock,
}: ZoomRotProps) => {
  const zooms = [10, 100, 250, 1600]
  const rotations = [0, 90, 180, 270]

  return (
    <div className="flex flex-col bg-dark-bg text-dark-text p-4 rounded-lg shadow-lg">
      <div>Zoom</div>

      <div className="flex items-center gap-2">
        <MagnifyingGlass />
        <input
          type="number"
          value={zoom}
          disabled={zoomLock}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="bg-transparent border rounded px-2"
        />
        <div onClick={onToggleZoomLock} className="cursor-pointer">
          {zoomLock ? <LockSimple /> : <LockSimpleOpen />}
        </div>
      </div>

      <div className="flex">
        {zooms.map((z) => (
          <div
            key={z}
            className={`px-4 py-2 rounded cursor-pointer ${
              zoomLock ? "opacity-40 pointer-events-none" : "hover:bg-settings-hover"
            }`}
            onClick={() => onZoomChange(z)}
          >
            {z}%
          </div>
        ))}
      </div>

      <div>Rotation</div>

      <div className="flex items-center gap-2">
        <ArrowCounterClockwise />
        <input
          type="number"
          value={rotation}
          disabled={rotLock}
          onChange={(e) => onRotationChange(Number(e.target.value))}
          className="bg-transparent border rounded px-2"
        />
        <div onClick={onToggleRotLock} className="cursor-pointer">
          {rotLock ? <LockSimple /> : <LockSimpleOpen />}
        </div>
      </div>

      <div className="flex">
        {rotations.map((r) => (
          <div
            key={r}
            className={`px-4 py-2 rounded cursor-pointer ${
              rotLock ? "opacity-40 pointer-events-none" : "hover:bg-settings-hover"
            }`}
            onClick={() => onRotationChange(r)}
          >
            {r}°
          </div>
        ))}
      </div>
    </div>
  )
}

export default ZoomRot
