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
 */
export const useAutoSave = (file: string | null, interval = 5000) => {
  const dirty = useRef(false)
  const saving = useRef(false)

  useEffect(
    () =>
      useCanvasStore.subscribe((state, prev) => {
        if (state.doc !== prev.doc) dirty.current = true
      }),
    [],
  )

  useEffect(() => {
    if (!file) return

    const save = (meta: FileMeta | null) =>
      invoke("save_canvas", {
        parent: pathDir(file),
        filename: baseFileName(file),
        canvas: useCanvasStore.getState().doc,
        meta,
      })

    const tick = async () => {
      if (!dirty.current || saving.current) return
      saving.current = true
      dirty.current = false
      try {
        const svg = document.getElementById(CANVAS_SVG_ID) as SVGSVGElement | null
        await save({ thumbnail: svg ? await captureThumbnail(svg) : null })
      } catch (error) {
        dirty.current = true // retry on the next tick
        console.error("Auto-save failed:", error)
      } finally {
        saving.current = false
      }
    }

    // Final flush on close: data only -- the backend keeps the last thumbnail.
    const flush = () => void save(null).catch(() => {})

    const timer = setInterval(tick, interval)
    window.addEventListener("beforeunload", flush)
    return () => {
      clearInterval(timer)
      window.removeEventListener("beforeunload", flush)
      flush() // closing the editor or the app flushes pending strokes
    }
  }, [file, interval])
}
