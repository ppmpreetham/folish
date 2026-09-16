import React from "react"
import { useCanvasStore } from "../../../stores/canvasStore"
import { CanvasBackgroundType, GridType } from "../../../types"
import { X, Check, Palette } from "phosphor-react"
import blueprintBg from "../../../assets/backgrounds/blueprint.png"
import brownPaperBg from "../../../assets/backgrounds/brown paper.png"
import crumpledPaperBg from "../../../assets/backgrounds/crumpled.png"

interface CanvasSettingsProps {
  onClose?: () => void
}

interface BackgroundOption {
  type: CanvasBackgroundType
  name: string
  color?: string
  imageSrc?: string
  isCheckerboard?: boolean
  isCustom?: boolean
}

const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    type: CanvasBackgroundType.Custom,
    name: "Custom",
    isCustom: true,
  },
  {
    type: CanvasBackgroundType.White,
    name: "Plain White",
    color: "#ffffff",
  },
  {
    type: CanvasBackgroundType.Transparent,
    name: "Transparent",
    isCheckerboard: true,
  },
  {
    type: CanvasBackgroundType.Crumpled,
    name: "Crumpled Paper",
    imageSrc: crumpledPaperBg,
    color: "#f5f0eb",
  },
  {
    type: CanvasBackgroundType.Blueprint,
    name: "BluePrint",
    imageSrc: blueprintBg,
    color: "#1e81cd",
  },
  {
    type: CanvasBackgroundType.Brown,
    name: "Brown Paper",
    imageSrc: brownPaperBg,
    color: "#996f4c",
  },
  {
    type: CanvasBackgroundType.Darkprint,
    name: "DarkPrint",
    color: "#1d252b",
  },
]

interface GridOption {
  type: GridType
  name: string
  renderIcon: () => React.ReactNode
}

const GRID_OPTIONS: GridOption[] = [
  {
    type: GridType.None,
    name: "None",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="6" y1="6" x2="22" y2="22" strokeLinecap="round" />
        <rect x="5" y="5" width="18" height="18" rx="3" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    type: GridType.Dot,
    name: "Dot Grid",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor">
        <circle cx="7" cy="7" r="1.5" />
        <circle cx="14" cy="7" r="1.5" />
        <circle cx="21" cy="7" r="1.5" />
        <circle cx="7" cy="14" r="1.5" />
        <circle cx="14" cy="14" r="1.5" />
        <circle cx="21" cy="14" r="1.5" />
        <circle cx="7" cy="21" r="1.5" />
        <circle cx="14" cy="21" r="1.5" />
        <circle cx="21" cy="21" r="1.5" />
      </svg>
    ),
  },
  {
    type: GridType.Graph,
    name: "Graph Paper",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M 0 7 L 28 7 M 0 14 L 28 14 M 0 21 L 28 21 M 7 0 L 7 28 M 14 0 L 14 28 M 21 0 L 21 28" />
      </svg>
    ),
  },
  {
    type: GridType.LinedHorizontal,
    name: "Lined (H)",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2">
        <line x1="2" y1="7" x2="26" y2="7" />
        <line x1="2" y1="14" x2="26" y2="14" />
        <line x1="2" y1="21" x2="26" y2="21" />
      </svg>
    ),
  },
  {
    type: GridType.LinedVertical,
    name: "Lined (V)",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2">
        <line x1="7" y1="2" x2="7" y2="26" />
        <line x1="14" y1="2" x2="14" y2="26" />
        <line x1="21" y1="2" x2="21" y2="26" />
      </svg>
    ),
  },
  {
    type: GridType.Isometric,
    name: "Isometric",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M 0 7 L 14 0 L 28 7 M 0 21 L 14 14 L 28 21 M 14 0 L 14 28 M 0 7 L 0 21 M 28 7 L 28 21" />
      </svg>
    ),
  },
  {
    type: GridType.Triangle,
    name: "Triangle",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1">
        <polygon points="14,3 26,24 2,24" />
        <line x1="14" y1="3" x2="14" y2="24" />
        <line x1="8" y1="13.5" x2="20" y2="13.5" />
      </svg>
    ),
  },
  {
    type: GridType.OnePoint,
    name: "1-Point",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="14" cy="14" r="2" fill="currentColor" />
        <line x1="0" y1="14" x2="28" y2="14" strokeWidth="1.2" />
        <line x1="14" y1="0" x2="14" y2="28" />
        <line x1="14" y1="14" x2="0" y2="0" />
        <line x1="14" y1="14" x2="28" y2="0" />
        <line x1="14" y1="14" x2="0" y2="28" />
        <line x1="14" y1="14" x2="28" y2="28" />
        <rect x="7" y="8.5" width="14" height="11" />
      </svg>
    ),
  },
  {
    type: GridType.TwoPoint,
    name: "2-Point",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1">
        <line x1="0" y1="14" x2="28" y2="14" strokeWidth="1.2" />
        <circle cx="2" cy="14" r="1.8" fill="currentColor" />
        <circle cx="26" cy="14" r="1.8" fill="currentColor" />
        <line x1="2" y1="14" x2="20" y2="2" />
        <line x1="2" y1="14" x2="20" y2="26" />
        <line x1="26" y1="14" x2="8" y2="2" />
        <line x1="26" y1="14" x2="8" y2="26" />
        <line x1="14" y1="4" x2="14" y2="24" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    type: GridType.ThreePoint,
    name: "3-Point",
    renderIcon: () => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1">
        <line x1="0" y1="9" x2="28" y2="9" strokeWidth="1" />
        <circle cx="2" cy="9" r="1.5" fill="currentColor" />
        <circle cx="26" cy="9" r="1.5" fill="currentColor" />
        <circle cx="14" cy="27" r="1.5" fill="currentColor" />
        <line x1="2" y1="9" x2="18" y2="2" />
        <line x1="26" y1="9" x2="10" y2="2" />
        <line x1="14" y1="27" x2="14" y2="2" />
        <line x1="14" y1="27" x2="5" y2="4" />
        <line x1="14" y1="27" x2="23" y2="4" />
      </svg>
    ),
  },
]

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({ onClose }) => {
  const currentBackground = useCanvasStore((s) => s.ui.canvasBackground)
  const currentGrid = useCanvasStore((s) => s.ui.gridType)
  const snapToGrid = useCanvasStore((s) => s.ui.snapToGrid)
  const setCanvasBackground = useCanvasStore((s) => s.setCanvasBackground)
  const setGridType = useCanvasStore((s) => s.setGridType)
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid)
  const setColorPickerOpen = useCanvasStore((s) => s.setColorPickerOpen)
  const setColorPickerTarget = useCanvasStore((s) => s.setColorPickerTarget)

  const handleSelectBackground = (opt: BackgroundOption) => {
    if (opt.isCustom) {
      setColorPickerTarget("canvasBackground")
      setColorPickerOpen(true)
      if (currentBackground.type !== CanvasBackgroundType.Custom) {
        setCanvasBackground({
          type: CanvasBackgroundType.Custom,
          color: currentBackground.color || "#ffffff",
        })
      }
      return
    }

    setCanvasBackground({
      type: opt.type,
      color: opt.color || "#ffffff",
    })
  }

  return (
    <div
      id="canvas-settings-bar"
      className="bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-5 w-[650px] max-w-[92vw] text-neutral-100 animate-in fade-in slide-in-from-top-3 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
            Canvas Settings
          </h2>
          <span className="text-xs text-neutral-400 font-normal">
            (Backgrounds & Grids)
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Background Color Section (Horizontal Scroll Bar) */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Background
        </span>
        <div className="flex flex-row items-center gap-5 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-neutral-700">
          {BACKGROUND_OPTIONS.map((opt) => {
            const isSelected = currentBackground.type === opt.type
            return (
              <div
                key={opt.type}
                onClick={() => handleSelectBackground(opt)}
                className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group select-none"
              >
                <div
                  className={`w-14 h-14 rounded-full border-2 transition-all duration-200 flex items-center justify-center shadow-md group-hover:scale-105 ${
                    isSelected
                      ? "border-blue-500 ring-4 ring-blue-500/30 scale-105"
                      : "border-neutral-600 hover:border-neutral-400"
                  }`}
                  style={
                    opt.isCustom
                      ? {
                          background:
                            currentBackground.type === CanvasBackgroundType.Custom && currentBackground.color
                              ? currentBackground.color
                              : "conic-gradient(from 180deg at 50% 50%, #FF0000 0deg, #FFFF00 60deg, #00FF00 120deg, #00FFFF 180deg, #0000FF 240deg, #FF00FF 300deg, #FF0000 360deg)",
                        }
                      : opt.isCheckerboard
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)",
                          backgroundSize: "12px 12px",
                          backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
                          backgroundColor: "#ffffff",
                        }
                      : opt.imageSrc
                      ? {
                          backgroundImage: `url("${opt.imageSrc}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundColor: opt.color || "#ffffff",
                        }
                      : { backgroundColor: opt.color }
                  }
                >
                  {opt.isCustom && currentBackground.type !== CanvasBackgroundType.Custom ? (
                    <Palette size={22} className="text-white drop-shadow-md" weight="bold" />
                  ) : isSelected ? (
                    <Check
                      size={20}
                      weight="bold"
                      className={
                        opt.color === "#ffffff" || opt.isCheckerboard || opt.type === CanvasBackgroundType.Crumpled
                          ? "text-neutral-900 drop-shadow"
                          : "text-white drop-shadow"
                      }
                    />
                  ) : null}
                </div>
                <span
                  className={`text-xs font-medium text-center whitespace-nowrap transition-colors ${
                    isSelected
                      ? "text-blue-400 font-semibold"
                      : "text-neutral-300 group-hover:text-white"
                  }`}
                >
                  {opt.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grid Types Section (Horizontal Scroll Bar) */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Grid Type
        </span>
        <div className="flex flex-row items-center gap-3 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-neutral-700">
          {GRID_OPTIONS.map((opt) => {
            const isSelected = currentGrid === opt.type
            return (
              <div
                key={opt.type}
                onClick={() => setGridType(opt.type)}
                className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group select-none"
              >
                <div
                  className={`w-14 h-14 rounded-xl border-2 transition-all duration-200 flex items-center justify-center shadow-md group-hover:scale-105 ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/15 text-blue-400 ring-4 ring-blue-500/25 scale-105"
                      : "border-neutral-700 bg-neutral-800/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
                  }`}
                >
                  {opt.renderIcon()}
                </div>
                <span
                  className={`text-xs font-medium text-center whitespace-nowrap transition-colors ${
                    isSelected
                      ? "text-blue-400 font-semibold"
                      : "text-neutral-300 group-hover:text-white"
                  }`}
                >
                  {opt.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Snapping toggle */}
      <div className="flex items-center justify-between border-t border-neutral-700/60 pt-3">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Snap to grid
        </span>
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
            snapToGrid ? "bg-blue-500" : "bg-neutral-700"
          }`}
          aria-label="Toggle snap to grid"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              snapToGrid ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
    </div>
  )
}
