import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import clsx from "clsx"
import { useShallow } from "zustand/react/shallow"
import {
  IconContext,
  Cursor,
  LockSimpleOpen,
  LockSimple,
  CopySimple,
  TrashSimple,
  TextAa,
  Stack,
  ArrowsDownUp,
  Plus,
  Eye,
  EyeSlash,
} from "phosphor-react"
import { useCanvasStore } from "../../stores/canvasStore"
import { Layer, Stroke } from "../../types"

const getLayerBounds = (strokes: Stroke[]) => {
  if (strokes.length === 0) return { x: 0, y: 0, width: 100, height: 100 }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  strokes.forEach((stroke) => {
    stroke.points.forEach((p) => {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    })
  })
  const width = maxX - minX
  const height = maxY - minY
  const padding = Math.max(width, height) * 0.1
  return {
    x: minX - padding,
    y: minY - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  }
}

const LayerThumbnail = memo(({ layerId }: { layerId: string }) => {
  const strokes = useCanvasStore(useShallow((state) => state.getStrokesByLayer(layerId)))
  const color = useCanvasStore((state) => state.ui.activeColor)
  const bounds = useMemo(() => getLayerBounds(strokes), [strokes])

  if (strokes.length === 0) {
    return <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded opacity-50" />
  }

  return (
    <div className="w-10 h-10 bg-white border border-gray-200 rounded overflow-hidden relative">
      <svg
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        className="w-full h-full pointer-events-none"
      >
        {strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={stroke.pathData}
            fill={stroke.color || color}
            opacity={stroke.opacity}
          />
        ))}
      </svg>
    </div>
  )
})

interface LayerSettingsProps {
  layer: Layer
  position: { top: number; left: number }
  onClose: () => void
  onRename: () => void
}

const LayerSettings = ({ layer, position, onClose, onRename }: LayerSettingsProps) => {
  const settingsRef = useRef<HTMLDivElement>(null)

  const setLayerOpacity = useCanvasStore((s) => s.setLayerOpacity)
  const setLayerOpacityTransient = useCanvasStore((s) => s.setLayerOpacityTransient)
  const deleteLayer = useCanvasStore((s) => s.deleteLayer)
  const setActiveLayer = useCanvasStore((s) => s.setActiveLayer)
  const toggleLayerLock = useCanvasStore((s) => s.toggleLayerLock)
  const duplicateLayer = useCanvasStore((s) => s.duplicateLayer)

  const [localOpacity, setLocalOpacity] = useState(Math.round(layer.opacity * 100))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={settingsRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      className="w-fit p-2 rounded-lg flex flex-col gap-2 bg-white border border-gray-200 animate-in fade-in zoom-in-95 duration-100 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-row gap-1 items-center justify-between">
        <IconContext.Provider
          value={{
            size: 28,
            className:
              "block w-fit p-1 rounded-md cursor-pointer hover:bg-gray-100 text-gray-700 transition-colors",
          }}
        >
          <Cursor
            weight={useCanvasStore.getState().ui.activeLayerId === layer.id ? "fill" : "regular"}
            onClick={() => setActiveLayer(layer.id)}
          />

          <div onClick={() => toggleLayerLock(layer.id)}>
            {layer.locked ? <LockSimple weight="fill" /> : <LockSimpleOpen />}
          </div>

          <CopySimple
            onClick={() => {
              duplicateLayer(layer.id)
              onClose()
            }}
          />

          <TextAa
            onClick={() => {
              onRename()
              onClose()
            }}
          />

          <TrashSimple
            className="hover:bg-red-50 hover:text-red-600"
            size={20}
            onClick={() => {
              deleteLayer(layer.id)
              onClose()
            }}
          />
        </IconContext.Provider>
      </div>

      <div className="h-px bg-gray-100 w-full" />

      <div className="flex flex-row items-center gap-2 px-1">
        <input
          type="range"
          min="0"
          max="100"
          value={localOpacity}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            setLocalOpacity(val)
            setLayerOpacityTransient(layer.id, val / 100)
          }}
          onMouseUp={(e) => {
            const val = parseInt((e.target as HTMLInputElement).value)
            setLayerOpacity(layer.id, val / 100)
          }}
          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black focus:outline-none"
        />
        <div className="text-xs font-semibold text-gray-600 w-8 text-right">{localOpacity}%</div>
      </div>
    </div>
  )
}

interface SingleLayerProps {
  layer: Layer
  isActive: boolean
  index: number
  showSettings: false | { top: number; left: number }
  onShowSettings: (pos: { top: number; left: number }) => void
  onHideSettings: () => void
}

const SingleLayer = ({
  layer,
  isActive,
  showSettings,
  onShowSettings,
  onHideSettings,
}: SingleLayerProps) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleLayerVisibility = useCanvasStore((s) => s.toggleLayerVisibility)
  const renameLayer = useCanvasStore((s) => s.renameLayer)
  const setActiveLayer = useCanvasStore((s) => s.setActiveLayer)

  const handleRename = () => {
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 10)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (showSettings) {
      onHideSettings()
    } else if (rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect()

      onShowSettings({
        top: rect.top,
        left: rect.right + 10,
      })
    }
  }

  return (
    <>
      <div
        ref={rowRef}
        className={clsx(
          "relative flex flex-row gap-3 items-center p-2 rounded-lg cursor-pointer transition-all duration-200 border group select-none",
          isActive
            ? "bg-blue-50/50 border-blue-200 shadow-sm"
            : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
        )}
        onClick={() => setActiveLayer(layer.id)}
        onContextMenu={handleContextMenu}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleLayerVisibility(layer.id)
          }}
          className={clsx(
            "p-1.5 rounded-md transition-colors",
            layer.visible ? "text-gray-500 hover:text-gray-900" : "text-gray-300"
          )}
        >
          {layer.visible ? <Eye size={18} /> : <EyeSlash size={18} />}
        </button>

        <div className="shrink-0">
          <LayerThumbnail layerId={layer.id} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
          <input
            ref={inputRef}
            className={clsx(
              "text-sm font-medium bg-transparent border-none p-0 focus:ring-0 w-full truncate cursor-pointer",
              isActive ? "text-gray-900" : "text-gray-600"
            )}
            value={layer.name}
            onChange={(e) => renameLayer(layer.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => {
              setActiveLayer(layer.id)
              e.target.select()
            }}
          />
          <div className="text-[10px] text-gray-400 flex items-center gap-1 h-3">
            {Math.round(layer.opacity * 100)}%
            {layer.locked && <LockSimple size={10} weight="fill" />}
          </div>
        </div>
      </div>

      {showSettings && (
        <LayerSettings
          layer={layer}
          position={showSettings as { top: number; left: number }}
          onClose={onHideSettings}
          onRename={handleRename}
        />
      )}
    </>
  )
}

const LayersNew = () => {
  const layers = useCanvasStore((state) => state.doc.layers)
  const activeLayerId = useCanvasStore((state) => state.ui.activeLayerId)
  const addLayer = useCanvasStore((state) => state.addLayer)

  const [autoSort, setAutoSort] = useState<boolean>(true)

  const [settingsState, setSettingsState] = useState<{
    id: string
    top: number
    left: number
  } | null>(null)

  const displayLayers = useMemo(() => [...layers].reverse(), [layers])

  return (
    <div className="fixed bottom-4 left-4 flex flex-col items-start gap-2 max-w-70">
      <div className="flex flex-row gap-2 mb-1">
        <button
          onClick={() => setAutoSort(!autoSort)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:text-gray-900 transition-all text-xs font-semibold"
        >
          <ArrowsDownUp size={16} />
          <span>{autoSort ? "Auto" : "Manual"}</span>
        </button>

        <button
          onClick={() => addLayer(`Layer ${layers.length + 1}`)}
          className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded-lg shadow-lg hover:bg-gray-800 transition-all text-xs font-semibold"
        >
          <Plus size={16} weight="bold" />
          <span>New Layer</span>
        </button>
      </div>
      <div className="flex flex-col-reverse w-full gap-1.5 p-1 max-h-[60vh] overflow-y-auto no-scrollbar">
        {displayLayers.map((layer, index) => (
          <SingleLayer
            key={layer.id}
            layer={layer}
            index={index}
            isActive={activeLayerId === layer.id}
            showSettings={settingsState?.id === layer.id ? settingsState : false}
            onShowSettings={(pos) => setSettingsState({ id: layer.id, ...pos })}
            onHideSettings={() => setSettingsState(null)}
          />
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur border border-gray-200 px-2 py-1 rounded-md text-[10px] font-bold text-gray-500 shadow-sm flex gap-2 items-center">
        <Stack size={12} />
        {layers.length} Layers
      </div>
    </div>
  )
}

export default LayersNew
