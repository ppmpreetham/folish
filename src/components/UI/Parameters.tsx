import { DownloadSimple, UploadSimple, GearSix, Info, IconContext } from "phosphor-react"
import { useState } from "react"
import ZoomRot from "./Parameters/ZoomRot"
import Import from "./Parameters/Import"

const Parameters = () => {
  const [zoom, setZoom] = useState<number>(100)
  const [zoomLock, setZoomLock] = useState(false)
  const [rotation, setRotation] = useState<number>(0)
  const [rotLock, setRotLock] = useState(false)
  return (
    <div className="flex flex-row">
      <IconContext.Provider
        value={{
          size: 40,
          weight: "fill",
          className: "block w-fit p-2 rounded cursor-pointer hover:bg-gray-200",
        }}
      >
        <div className="block w-fit h-fit p-2 rounded cursor-pointer hover:bg-gray-200">100%</div>
        <div className="block w-fit h-fit p-2 rounded cursor-pointer hover:bg-gray-200">0%</div>
        <DownloadSimple />
        <UploadSimple />
        <GearSix />
        <Info />
        <ZoomRot />
        <Import />
      </IconContext.Provider>
    </div>
  )
}

export default Parameters
