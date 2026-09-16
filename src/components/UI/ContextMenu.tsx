import { useEffect, useMemo, useRef } from "react"
import {
  ArrowsOutSimple,
  ArrowsInSimple,
  CopySimple,
  Clipboard,
  Scissors,
  TrashSimple,
  SquareHalf,
  ArrowsDownUp,
  SquaresFour,
  MagnifyingGlassPlus,
  FrameCorners,
  ArrowsCounterClockwise,
} from "phosphor-react"
import { useCanvasStore } from "../../stores/canvasStore"
import type { FC, ReactNode } from "react"

interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  separatorAfter?: boolean
  action: () => void
}

const MENU_W = 224

export const ContextMenu: FC = () => {
  const contextMenu = useCanvasStore((state) => state.ui.contextMenu)
  const setContextMenu = useCanvasStore((state) => state.setContextMenu)
  const selectedStrokeIds = useCanvasStore((state) => state.ui.selectedStrokeIds)
  const clipboard = useCanvasStore((state) => state.clipboard)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setContextMenu(null)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null)
    }
    window.addEventListener("pointerdown", close, true)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerdown", close, true)
      window.removeEventListener("keydown", onKey)
    }
  }, [contextMenu, setContextMenu])

  const store = useMemo(() => useCanvasStore.getState, [])

  if (!contextMenu) return null

  const hasSelection = selectedStrokeIds.length > 0
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const left = Math.min(contextMenu.screen.x, viewportWidth - MENU_W - 12)
  const top = Math.min(contextMenu.screen.y, viewportHeight - 420)

  const run = (fn: () => void) => () => {
    fn()
    setContextMenu(null)
  }

  const items: MenuItem[] = [
    {
      id: "select-all",
      label: "Select all",
      icon: <SquaresFour size={16} />,
      shortcut: "Ctrl+A",
      action: run(() => store().selectAll()),
    },
    {
      id: "cut",
      label: "Cut",
      icon: <Scissors size={16} />,
      shortcut: "Ctrl+X",
      disabled: !hasSelection,
      action: run(() => store().cutSelection()),
    },
    {
      id: "copy",
      label: "Copy",
      icon: <CopySimple size={16} />,
      shortcut: "Ctrl+C",
      disabled: !hasSelection,
      action: run(() => store().copySelection()),
    },
    {
      id: "paste",
      label: "Paste",
      icon: <Clipboard size={16} />,
      shortcut: "Ctrl+V",
      disabled: clipboard.length === 0,
      action: run(() => store().pasteClipboard()),
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: <CopySimple size={16} weight="duotone" />,
      shortcut: "Ctrl+D",
      disabled: !hasSelection,
      separatorAfter: true,
      action: run(() => store().duplicateSelection()),
    },
    {
      id: "bring-front",
      label: "Bring to front",
      icon: <ArrowsOutSimple size={16} />,
      shortcut: "Ctrl+Shift+]",
      disabled: !hasSelection,
      action: run(() => store().bringToFront(store().ui.selectedStrokeIds)),
    },
    {
      id: "send-back",
      label: "Send to back",
      icon: <ArrowsInSimple size={16} />,
      shortcut: "Ctrl+Shift+[",
      disabled: !hasSelection,
      action: run(() => store().sendToBack(store().ui.selectedStrokeIds)),
    },
    {
      id: "flip-h",
      label: "Flip horizontal",
      icon: <SquareHalf size={16} weight="fill" style={{ transform: "rotate(90deg)" }} />,
      shortcut: "Ctrl+Shift+H",
      disabled: !hasSelection,
      action: run(() => store().flipSelection("x")),
    },
    {
      id: "flip-v",
      label: "Flip vertical",
      icon: <ArrowsDownUp size={16} />,
      shortcut: "Ctrl+Shift+V",
      disabled: !hasSelection,
      separatorAfter: true,
      action: run(() => store().flipSelection("y")),
    },
    {
      id: "zoom-selection",
      label: "Zoom to selection",
      icon: <FrameCorners size={16} />,
      shortcut: "Shift+2",
      disabled: !hasSelection,
      action: run(() => store().zoomToSelection()),
    },
    {
      id: "zoom-fit",
      label: "Zoom to fit",
      icon: <MagnifyingGlassPlus size={16} />,
      shortcut: "Shift+1",
      action: run(() => store().zoomToFit()),
    },
    {
      id: "reset-zoom",
      label: "Reset zoom",
      icon: <ArrowsCounterClockwise size={16} />,
      shortcut: "Ctrl+0",
      action: run(() => store().resetZoom()),
    },
    {
      id: "delete",
      label: "Delete",
      icon: <TrashSimple size={16} />,
      shortcut: "Del",
      disabled: !hasSelection,
      danger: true,
      action: run(() => store().deleteStrokes(store().ui.selectedStrokeIds)),
    },
  ]

  return (
    <div
      ref={ref}
      className="fixed z-[200] bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-xl shadow-2xl py-1.5 text-neutral-100 animate-in fade-in zoom-in-95 duration-100"
      style={{ left, top, width: MENU_W }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <div key={item.id}>
          <button
            disabled={item.disabled}
            onClick={item.action}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors ${
              item.disabled
                ? "text-neutral-600 cursor-default"
                : item.danger
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-neutral-200 hover:bg-neutral-700/60"
            }`}
          >
            <span className="w-4 flex justify-center opacity-80">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && <span className="text-[11px] text-neutral-500">{item.shortcut}</span>}
          </button>
          {item.separatorAfter && <div className="my-1 border-t border-neutral-700/70" />}
        </div>
      ))}
    </div>
  )
}

export default ContextMenu
