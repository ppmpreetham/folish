import { useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useCanvasStore } from "../stores/canvasStore"
import { baseFileName, pathDir } from "../utils/paths"
import type { FileMeta } from "../types"

const THUMB_WIDTH = 320
const CANVAS_SVG_ID = "canvas-svg"

/** Rasterizes the live canvas SVG into a small PNG data URL for embedding in the file. */
const captureThumbnail = async (svg: SVGSVGElement): Promise<string> => {
  const { width, height } = svg.getBoundingClientRect()
  if (!width || !height) return ""

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    new XMLSerializer().serializeToString(clone),
  )}`

  const thumbHeight = Math.round((THUMB_WIDTH * height) / width)
  const canvas = document.createElement("canvas")
  canvas.width = THUMB_WIDTH
  canvas.height = thumbHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  const img = new Image()
  img.src = src
  try {
    await img.decode()
  } catch {
    return ""
  }
  ctx.fillStyle = "#ffffff" // the container's CSS background isn't part of the SVG
  ctx.fillRect(0, 0, THUMB_WIDTH, thumbHeight)
  ctx.drawImage(img, 0, 0, THUMB_WIDTH, thumbHeight)
  return canvas.toDataURL("image/png")
}

/**
 * Dirty-flag autosave, bound to one open file: strokes mutate the doc (marking
 * it dirty), one interval ticks, and a single in-flight save serializes +
 * captures the thumbnail. Backend merges meta, so `thumbnail: null` preserves
 * the previous image. `file` is the opened drawing's full path; saving is
 * skipped until one is open.
 *
 * Returns `flush()`, which resolves once every pending stroke is on disk --
 * await it before anything that re-reads the file (e.g. leaving the editor).
 */
export const useAutoSave = (file: string | null, interval = 5000) => {
  const dirty = useRef(false)
  const saving = useRef(false)
  const inflight = useRef<Promise<void>>(Promise.resolve())
  const flushRef = useRef<() => Promise<void>>(async () => {})

  useEffect(
    () =>
      useCanvasStore.subscribe((state, prev) => {
        if (state.doc !== prev.doc) dirty.current = true
      }),
    [],
  )

  useEffect(() => {
    if (!file) {
      flushRef.current = async () => {}
      return
    }

    dirty.current = false // a fresh open has nothing unsaved (loadDoc marks dirty)

    const save = (meta: FileMeta | null) =>
      invoke("save_canvas", {
        parent: pathDir(file),
        filename: baseFileName(file),
        canvas: useCanvasStore.getState().doc,
        meta,
      })

    // One writer, ever: joins the running save instead of racing it. Clears
    // dirty at snap time; strokes drawn during thumbnail capture re-mark it.
    const saveDirty = (): Promise<void> => {
      if (saving.current) return inflight.current
      saving.current = true
      dirty.current = false
      inflight.current = (async () => {
        try {
          const svg = document.getElementById(CANVAS_SVG_ID) as SVGSVGElement | null
          const thumbnail = svg ? await captureThumbnail(svg) : null
          await save({ thumbnail })
        } catch (error) {
          dirty.current = true // retry on the next tick
          console.error("Auto-save failed:", error)
        } finally {
          saving.current = false
        }
      })()
      return inflight.current
    }

    // Resolves with every pending stroke on disk (a capture can miss strokes
    // drawn mid-save, so loop until clean).
    const flush = async () => {
      for (let i = 0; i < 3 && dirty.current; i++) await saveDirty()
    }
    flushRef.current = flush

    const timer = setInterval(() => {
      if (dirty.current) void saveDirty()
    }, interval)

    const onUnload = () => void flush()
    window.addEventListener("beforeunload", onUnload)
    return () => {
      clearInterval(timer)
      window.removeEventListener("beforeunload", onUnload)
      void flush() // unmount (HMR) with unsaved strokes still writes
    }
  }, [file, interval])

  return () => flushRef.current()
}
