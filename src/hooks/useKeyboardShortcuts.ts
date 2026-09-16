import { useEffect } from "react"
import { useCanvasStore } from "../stores/canvasStore"

const NUDGE_SMALL = 1
const NUDGE_LARGE = 10

/**
 * tldraw-inspired keyboard shortcuts:
 * - Tools: V select · H pan · T text · R rect · O ellipse · L line · A arrow · D draw · M marquee · F fill
 * - Ctrl+A select all, Ctrl+C/X/V, Ctrl+D duplicate, Del delete
 * - Arrows nudge selection (Shift = 10x)
 * - Ctrl+]/[ order, Ctrl+Shift+]/[ front/back, Ctrl+Shift+H/V flip
 * - Shift+1 zoom to fit, Shift+2 zoom to selection, Ctrl+0 reset zoom, Ctrl+=/- zoom
 */
export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }

      const state = useCanvasStore.getState()
      const { ui } = state
      const isCtrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      const stop = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }

      // Undo/redo (browser-style) — also covers Delete/Escape.
      if ((e.key === "Delete" || e.key === "Backspace") && ui.selectedStrokeIds.length > 0) {
        stop()
        state.deleteStrokes(ui.selectedStrokeIds)
        return
      }

      if (e.key === "Escape") {
        if (ui.contextMenu) {
          state.setContextMenu(null)
          return
        }
        if (ui.selectedStrokeIds.length > 0) {
          stop()
          state.setSelectedStrokes([])
          return
        }
      }

      if (isCtrl) {
        if (key === "z" && !e.shiftKey) {
          stop()
          state.undo()
          return
        }
        if ((key === "z" && e.shiftKey) || (key === "y" && !e.shiftKey)) {
          stop()
          state.redo()
          return
        }
        if (key === "a") {
          stop()
          state.selectAll()
          return
        }
        if (key === "c") {
          if (ui.selectedStrokeIds.length > 0) {
            stop()
            state.copySelection()
          }
          return
        }
        if (key === "x") {
          if (ui.selectedStrokeIds.length > 0) {
            stop()
            state.cutSelection()
          }
          return
        }
        if (key === "v") {
          if (e.shiftKey) return // Ctrl+Shift+V = flip vertical
          if (state.clipboard.length > 0) {
            stop()
            state.pasteClipboard()
          }
          return
        }
        if (key === "d" && !e.shiftKey) {
          stop()
          state.duplicateSelection()
          return
        }
        if (key === "]") {
          stop()
          if (e.shiftKey) state.bringToFront(ui.selectedStrokeIds)
          else state.bringForward(ui.selectedStrokeIds)
          return
        }
        if (key === "[") {
          stop()
          if (e.shiftKey) state.sendToBack(ui.selectedStrokeIds)
          else state.sendBackward(ui.selectedStrokeIds)
          return
        }
        if (key === "h" && e.shiftKey) {
          stop()
          state.flipSelection("x")
          return
        }
        if (key === "0") {
          stop()
          state.resetZoom()
          return
        }
        if (key === "=" || key === "+") {
          stop()
          state.zoomBy(1.25)
          return
        }
        if (key === "-") {
          stop()
          state.zoomBy(0.8)
          return
        }
        return
      }

      // Shift+1 / Shift+2: zoom to fit / selection.
      if (e.shiftKey && (e.key === "!" || e.key === "1")) {
        stop()
        state.zoomToFit()
        return
      }
      if (e.shiftKey && (e.key === "@" || e.key === "2")) {
        stop()
        state.zoomToSelection()
        return
      }

      // Arrow-key nudging of the selection.
      if (e.key.startsWith("Arrow") && ui.selectedStrokeIds.length > 0) {
        stop()
        const step = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
        state.translateStrokes(ui.selectedStrokeIds, dx, dy)
        return
      }

      // Tool shortcuts (plain keys).
      if (e.shiftKey || e.altKey) return
      const toolByKey: Record<string, string> = {
        v: "selection",
        h: "pan",
        t: "text",
        r: "rect",
        o: "ellipse",
        l: "line",
        a: "arrow",
        d: "pen",
        m: "marquee",
        f: "fill",
        e: "nudge",
      }
      const tool = toolByKey[key]
      if (tool && !isCtrl) {
        stop()
        if (tool === "fill") state.setActiveTool("fill")
        else if (tool === "pen") {
          state.setActiveBrush("pen")
          state.setActiveTool("pen")
        } else state.setActiveTool(tool)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
}
