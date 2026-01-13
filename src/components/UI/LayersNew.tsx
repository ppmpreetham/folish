import clsx from "clsx"
import { useEffect, useRef } from "react"

import {
  IconContext,
  Stack,
  ArrowsDownUp,
  Eye,
  EyeSlash,
  Cursor,
  LockSimpleOpen,
  LockSimple,
  CopySimple,
  TrashSimple,
  TextAa,
  Plus,
} from "phosphor-react"
import { useState } from "react"

const LayerSettings = ({
  settingsRef,
}: {
  settingsRef: React.RefObject<HTMLDivElement | null>
}) => {
  const [opacity, setOpacity] = useState(100)
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      ref={settingsRef}
      className="w-fit p-2 rounded-sm flex flex-col gap-2 border border-black"
    >
      <div className="flex flex-row gap-4 items-center">
        <IconContext.Provider
          value={{
            size: 40,
            className: "block w-fit p-2 rounded cursor-pointer hover:bg-gray-200",
          }}
        >
          <Cursor />
          <LockSimpleOpen />
          <CopySimple />
          <TrashSimple />
          <TextAa />
        </IconContext.Provider>
      </div>
      <div className="flex flex-row items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          onMouseUp={(e) => {
            const target = e.target as HTMLInputElement
            console.log("Final value:", target.value)
            // replace the update layer logic for undo/redo history here for mouse
          }}
          onTouchEnd={(e) => {
            const target = e.target as HTMLInputElement
            console.log("Final value:", target.value)
            // replace the update layer logic for undo/redo history here for touch
          }}
          className="w-full h-1 rounded-2xl appearance-none bg-black accent-black outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-2.5 [&::-moz-range-thumb]:size-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:border-2 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black [&::-moz-range-thumb]:border-black [&::-webkit-slider-thumb]:cursor-pointer[&::-moz-range-thumb]:cursor-pointer"
        />
        <div className="h-6 mb-1">
          <div>{opacity}%</div>
        </div>
      </div>
    </div>
  )
}
export interface SingleLayerProps {
  isFirst: boolean
  layerName: string
  opacity: number
}
const SingleLayer = ({
  isFirst,
  layerName,
  opacity,
  showSettings,
  onShowSettings,
  onHideSettings,
  index,
}: SingleLayerProps & {
  showSettings: boolean
  onShowSettings: () => void
  onHideSettings: () => void
  index: number
}) => {
  const [visible, setVisible] = useState<boolean>(true)
  const [locked, setLocked] = useState<boolean>(false)

  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSettings) return

    const handler = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) {
        onHideSettings()
      }
    }

    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showSettings])
  return (
    <div
      className="items-center justify-center flex flex-row gap-2 w-fit"
      onClick={() => onHideSettings()}
    >
      <button
        onClick={() => setVisible((v) => !v)}
        className={clsx(
          "hover:bg-gray-200 rounded-full p-1 relative flex items-center justify-center",
          isFirst
            ? "after:content-[''] after:absolute after:left-1/2 after:top-1/2 after:w-0.5 after:h-1/2 after:bg-gray-400 after:transform after:-translate-x-1/2"
            : "after:content-[''] after:absolute after:left-1/2 after:top-0 after:w-0.5 after:h-1/2 after:bg-gray-400 after:transform after:-translate-x-1/2"
        )}
        aria-label={visible ? "Hide layer" : "Show layer"}
      >
        {/* Vertical line from the center */}
        <span className="absolute left-1/2 top-1/2 w-0.5 h-4 bg-gray-400 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        {visible ? <Eye weight="regular" size={24} /> : <EyeSlash weight="regular" size={24} />}
      </button>
      <button
        className="hover:bg-gray-300 flex flex-row gap-2 items-center justify-center pr-2 relative"
        onContextMenu={(e) => {
          e.preventDefault()
          onShowSettings()
        }}
        onDoubleClick={() => onShowSettings()}
      >
        <div className="">{/* here goes the map of that layer */}</div>
        <div className="test-sm">
          <div>{layerName}</div>
          <div>{opacity}%</div>
        </div>
        {showSettings && (
          <div className="absolute left-full top-0 ml-2 z-10">
            <LayerSettings settingsRef={settingsRef} />
          </div>
        )}
      </button>
    </div>
  )
}

const LayersNew = () => {
  const [autoSort, setAutoSort] = useState<boolean>(true)
  const [openSettingsIndex, setOpenSettingsIndex] = useState<number | null>(null)
  const layerList: SingleLayerProps[] = [
    { isFirst: true, layerName: "Layer 1", opacity: 100 },
    { isFirst: false, layerName: "Layer 2", opacity: 80 },
    { isFirst: false, layerName: "Layer 3", opacity: 60 },
  ]

  return (
    <div>
      <button className="flex flex-row gap-2 items-center justify-center w-fit">
        <Stack weight="regular" size={24} />
        <div className="text-sm font-semibold">Layers</div>
      </button>
      <button className="flex flex-row gap-2 items-center justify-center w-fit">
        <ArrowsDownUp weight="regular" size={24} />
        <div className="text-sm font-semibold">Sorting | {autoSort ? "Automatic" : "Manual"}</div>
      </button>
      <button className="flex flex-row gap-2 items-center justify-center w-fit">
        <Plus weight="regular" size={24} />
        <div className="text-sm font-semibold">New Layer</div>
      </button>

      {layerList.map((layerProps, index) => (
        <SingleLayer
          key={index}
          {...layerProps}
          index={index}
          showSettings={openSettingsIndex === index}
          onShowSettings={() => setOpenSettingsIndex(index)}
          onHideSettings={() => setOpenSettingsIndex(null)}
        />
      ))}
    </div>
  )
}

export default LayersNew
