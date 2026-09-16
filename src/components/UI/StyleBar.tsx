import type { FC } from "react"
import {
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  CircleHalf,
} from "phosphor-react"
import { useCanvasStore } from "../../stores/canvasStore"
import type { DashType, FillType, FontFamilyId, ShapeSize, TextAlign } from "../../types"
import { isShapeTool } from "../../utils/toolsData"
import { TEXT_FONT_SIZES } from "../../utils/textStyle"

const PALETTE = [
  { color: "#1d1d1d", name: "Black" },
  { color: "#5f6a72", name: "Grey" },
  { color: "#c1c7cc", name: "Light grey" },
  { color: "#ffffff", name: "White" },
  { color: "#3b82f6", name: "Blue" },
  { color: "#10b981", name: "Green" },
  { color: "#ef4444", name: "Red" },
  { color: "#f59e0b", name: "Amber" },
  { color: "#8b5cf6", name: "Violet" },
]

const FILLS: { id: FillType; label: string; icon: FC<{ size?: number }> }[] = [
  {
    id: "none",
    label: "None",
    icon: (props) => (
      <svg width={props.size ?? 14} height={props.size ?? 14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="10" height="10" rx="2" strokeDasharray="2 2" />
        <line x1="2" y1="12" x2="12" y2="2" />
      </svg>
    ),
  },
  { id: "half", label: "Half", icon: (props) => <CircleHalf {...props} /> },
  {
    id: "solid",
    label: "Solid",
    icon: (props) => (
      <svg width={props.size ?? 14} height={props.size ?? 14} viewBox="0 0 14 14">
        <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
      </svg>
    ),
  },
]

const DASHES: { id: DashType; label: string; dash: string }[] = [
  { id: "solid", label: "Solid", dash: "" },
  { id: "dashed", label: "Dashed", dash: "6 4" },
  { id: "dotted", label: "Dotted", dash: "1 4" },
]

const SIZES: { id: ShapeSize; label: string; px: number }[] = [
  { id: "s", label: "Small", px: 3 },
  { id: "m", label: "Medium", px: 5 },
  { id: "l", label: "Large", px: 8 },
  { id: "xl", label: "Huge", px: 12 },
]

const FONT_FAMILIES: { id: FontFamilyId; label: string; css: string }[] = [
  { id: "draw", label: "Draw", css: "'Segoe Print', cursive" },
  { id: "sans", label: "Sans", css: "Inter, sans-serif" },
  { id: "serif", label: "Serif", css: "Georgia, serif" },
  { id: "mono", label: "Mono", css: "Consolas, monospace" },
]

const ALIGNS: { id: TextAlign; icon: FC<{ size?: number }>; label: string }[] = [
  { id: "left", icon: TextAlignLeft, label: "Align left" },
  { id: "center", icon: TextAlignCenter, label: "Align center" },
  { id: "right", icon: TextAlignRight, label: "Align right" },
]

const Divider = () => <div className="w-px h-7 bg-neutral-700/80 mx-1.5 self-center" />

const SegmentGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-0.5 bg-neutral-800/80 rounded-lg p-0.5">{children}</div>
)

const segmentClass = (active: boolean) =>
  `w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
    active ? "bg-neutral-600/90 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-700/60"
  }`

export const StyleBar: FC = () => {
  const ui = useCanvasStore((state) => state.ui)
  const doc = useCanvasStore((state) => state.doc)
  const setSelectionStyle = useCanvasStore((state) => state.setSelectionStyle)
  const setSelectionTextStyle = useCanvasStore((state) => state.setSelectionTextStyle)
  const setActiveColor = useCanvasStore((state) => state.setActiveColor)
  const setActiveFill = useCanvasStore((state) => state.setActiveFill)
  const setActiveDash = useCanvasStore((state) => state.setActiveDash)
  const setActiveShapeSize = useCanvasStore((state) => state.setActiveShapeSize)
  const setActiveFontSize = useCanvasStore((state) => state.setActiveFontSize)
  const setActiveFontFamily = useCanvasStore((state) => state.setActiveFontFamily)
  const setActiveTextAlign = useCanvasStore((state) => state.setActiveTextAlign)

  const selectedIds = ui.selectedStrokeIds
  const hasSelection = selectedIds.length > 0
  const hasShapes = hasSelection && selectedIds.some((id) => !!doc.shapes?.[id])
  const hasTexts = hasSelection && selectedIds.some((id) => !!doc.texts[id])
  const isShapeToolActive = isShapeTool(ui.activeTool)
  const isTextToolActive = ui.activeTool === "text"

  const showShapeStyles = hasShapes || isShapeToolActive
  const showTextStyles = hasTexts || isTextToolActive

  if (!showShapeStyles && !showTextStyles && !hasSelection) return null

  // Current effective values (selection values win for display; otherwise active defaults).
  const currentColor = (() => {
    if (hasSelection) {
      for (const id of selectedIds) {
        const color = doc.shapes?.[id]?.color ?? doc.texts[id]?.color ?? doc.strokes[id]?.color
        if (color) return color
      }
    }
    return ui.activeColor
  })()

  const onColor = (color: string) => {
    setActiveColor(color)
    if (hasSelection) setSelectionStyle({ color })
  }
  const onFill = (fill: FillType) => {
    setActiveFill(fill)
    if (hasShapes) setSelectionStyle({ fill })
  }
  const onDash = (dash: DashType) => {
    setActiveDash(dash)
    if (hasShapes) setSelectionStyle({ dash })
  }
  const onSize = (size: ShapeSize) => {
    setActiveShapeSize(size)
    if (hasShapes) setSelectionStyle({ size })
  }
  const onFontSize = (fontSize: number) => {
    setActiveFontSize(fontSize)
    if (hasTexts) setSelectionTextStyle({ fontSize })
  }
  const onFontFamily = (family: FontFamilyId) => {
    setActiveFontFamily(family)
    if (hasTexts) setSelectionTextStyle({ fontFamily: family })
  }
  const onAlign = (align: TextAlign) => {
    setActiveTextAlign(align)
    if (hasTexts) setSelectionTextStyle({ textAlign: align })
  }
  const onToggleBold = () => {
    if (!hasTexts) return
    const anyNonBold = selectedIds.some((id) => doc.texts[id] && !doc.texts[id].bold)
    setSelectionTextStyle({ bold: anyNonBold })
  }
  const onToggleItalic = () => {
    if (!hasTexts) return
    const anyNonItalic = selectedIds.some((id) => doc.texts[id] && !doc.texts[id].italic)
    setSelectionTextStyle({ italic: anyNonItalic })
  }

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[150] bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl px-3 py-2 flex items-center gap-1 text-neutral-100 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-[96vw] overflow-x-auto custom-scrollbar"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Colors */}
      <div className="flex items-center gap-1">
        {PALETTE.map((swatch) => (
          <button
            key={swatch.color}
            title={swatch.name}
            onClick={() => onColor(swatch.color)}
            className={`w-6 h-6 rounded-md border transition-transform cursor-pointer hover:scale-110 ${
              currentColor.toLowerCase() === swatch.color.toLowerCase()
                ? "ring-2 ring-blue-400 border-transparent scale-110"
                : "border-neutral-600/80"
            }`}
            style={{ backgroundColor: swatch.color }}
          />
        ))}
      </div>

      {showShapeStyles && (
        <>
          <Divider />
          {/* Fill */}
          <SegmentGroup>
            {FILLS.map((fill) => (
              <button
                key={fill.id}
                title={`Fill: ${fill.label}`}
                onClick={() => onFill(fill.id)}
                className={segmentClass(
                  hasSelection && hasShapes
                    ? selectedIds.some((id) => doc.shapes?.[id]?.fill === fill.id)
                    : ui.activeFill === fill.id,
                )}
              >
                <fill.icon size={14} />
              </button>
            ))}
          </SegmentGroup>
          {/* Dash */}
          <SegmentGroup>
            {DASHES.map((dash) => (
              <button
                key={dash.id}
                title={`Dash: ${dash.label}`}
                onClick={() => onDash(dash.id)}
                className={segmentClass(
                  hasSelection && hasShapes
                    ? selectedIds.some((id) => doc.shapes?.[id]?.dash === dash.id)
                    : ui.activeDash === dash.id,
                )}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <line
                    x1="3"
                    y1="9"
                    x2="15"
                    y2="9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={dash.dash || undefined}
                    strokeLinecap={dash.id === "dotted" ? "round" : "butt"}
                  />
                </svg>
              </button>
            ))}
          </SegmentGroup>
          {/* Size */}
          <SegmentGroup>
            {SIZES.map((size) => (
              <button
                key={size.id}
                title={`Size: ${size.label}`}
                onClick={() => onSize(size.id)}
                className={segmentClass(
                  hasSelection && hasShapes
                    ? selectedIds.some((id) => doc.shapes?.[id]?.size === size.id)
                    : ui.activeShapeSize === size.id,
                )}
              >
                <span
                  className="rounded-full bg-current block"
                  style={{ width: size.px, height: size.px }}
                />
              </button>
            ))}
          </SegmentGroup>
        </>
      )}

      {showTextStyles && (
        <>
          <Divider />
          {/* Font family */}
          <SegmentGroup>
            {FONT_FAMILIES.map((font) => (
              <button
                key={font.id}
                title={`Font: ${font.label}`}
                onClick={() => onFontFamily(font.id)}
                className={`h-7 px-2 rounded-md flex items-center justify-center transition-colors cursor-pointer text-[12px] ${
                  hasSelection && hasTexts
                    ? selectedIds.some((id) => doc.texts[id]?.fontFamily === font.id)
                      ? "bg-neutral-600/90 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-700/60"
                    : ui.activeFontFamily === font.id
                      ? "bg-neutral-600/90 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-700/60"
                }`}
                style={{ fontFamily: font.css }}
              >
                {font.label}
              </button>
            ))}
          </SegmentGroup>
          {/* Font size */}
          <SegmentGroup>
            {TEXT_FONT_SIZES.map((size) => (
              <button
                key={size}
                title={`Font size: ${size}`}
                onClick={() => onFontSize(size)}
                className={`h-7 px-1.5 rounded-md flex items-center justify-center transition-colors cursor-pointer text-[11px] ${
                  hasSelection && hasTexts
                    ? selectedIds.some((id) => (doc.texts[id]?.fontSize ?? 24) === size)
                      ? "bg-neutral-600/90 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-700/60"
                    : ui.activeFontSize === size
                      ? "bg-neutral-600/90 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-700/60"
                }`}
              >
                {size}
              </button>
            ))}
          </SegmentGroup>
          {/* Align */}
          <SegmentGroup>
            {ALIGNS.map((align) => (
              <button
                key={align.id}
                title={align.label}
                onClick={() => onAlign(align.id)}
                className={segmentClass(
                  hasSelection && hasTexts
                    ? selectedIds.some((id) => (doc.texts[id]?.textAlign ?? "left") === align.id)
                    : ui.activeTextAlign === align.id,
                )}
              >
                <align.icon size={14} />
              </button>
            ))}
          </SegmentGroup>
          <SegmentGroup>
            <button
              title="Bold"
              onClick={onToggleBold}
              disabled={!hasTexts}
              className={`${segmentClass(hasSelection && hasTexts && selectedIds.some((id) => doc.texts[id]?.bold))} font-bold text-[13px] disabled:opacity-40`}
            >
              B
            </button>
            <button
              title="Italic"
              onClick={onToggleItalic}
              disabled={!hasTexts}
              className={`${segmentClass(hasSelection && hasTexts && selectedIds.some((id) => doc.texts[id]?.italic))} italic font-serif text-[13px] disabled:opacity-40`}
            >
              I
            </button>
          </SegmentGroup>
        </>
      )}
    </div>
  )
}

export default StyleBar
