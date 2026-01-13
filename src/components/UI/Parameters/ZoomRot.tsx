import { MagnifyingGlass, LockSimple, LockSimpleOpen, ArrowCounterClockwise } from "phosphor-react"

const ZoomRot = () => {
  const zooms = [10, 100, 250, 1600]
  const rotations = [0, 90, 180, 270]

  return (
    <div className="flex flex-col">
      <div>Zoom</div>
      <div className="flex flex-row">
        <MagnifyingGlass />
        <input />
        <LockSimple />
        {/* islocked? locksimple : locksimpleopen */}
      </div>
      <div className="flex flex-row">
        {zooms.map((z) => (
          <div
            className="px-4 py-2"
            key={z}
            // onClick={() => setZoom(z)}
          >
            {z}%
          </div>
        ))}
      </div>
      <div>Rotation</div>
      <div className="flex flex-row">
        <ArrowCounterClockwise />
        <input />
        <LockSimple />
        {/* islocked? locksimple : locksimpleopen */}
      </div>
      <div className="flex flex-row">
        {rotations.map((z) => (
          <div
            className="px-4 py-2"
            key={z}
            // onClick={() => setRotation(z)}
          >
            {z}%
          </div>
        ))}
      </div>
    </div>
  )
}

export default ZoomRot
