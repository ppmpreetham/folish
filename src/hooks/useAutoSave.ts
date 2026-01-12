import { useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useCanvasStore } from "../stores/canvasStore"

export const useAutoSave = (interval: number = 5000) => {
  const doc = useCanvasStore((state) => state.doc)
  const lastSaveRef = useRef<string>("")

  useEffect(() => {
    const timer = setInterval(async () => {
      const currentState = JSON.stringify(doc)
      if (currentState === lastSaveRef.current) return

      try {
        await invoke("save_canvas", { canvas: doc, filename: "autosave" })
        lastSaveRef.current = currentState
      } catch (error) {
        console.error("Auto-save failed:", error)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [doc, interval])
}
