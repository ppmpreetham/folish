import React, { useState } from "react"
import { Clipboard } from "phosphor-react"
import { useCanvasStore } from "../../../../stores/canvasStore"
import { calculateCenteredImagePosition } from "./types"

interface ClipboardImportProps {
  onSuccess?: () => void
  onError?: (err: string) => void
}

export const ClipboardImport: React.FC<ClipboardImportProps> = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(false)
  const addImage = useCanvasStore((state) => state.addImage)
  const camera = useCanvasStore((state) => state.ui.camera)
  const activeLayerId = useCanvasStore((state) => state.ui.activeLayerId)

  const handlePasteClick = async () => {
    try {
      setLoading(true)

      if (!navigator.clipboard?.read) {
        // Fallback to text check if read() isn't available
        const text = await navigator.clipboard?.readText()
        if (text && (text.startsWith("data:image/") || text.startsWith("http"))) {
          insertImageFromSrc(text)
          return
        }
        onError?.("Clipboard image reading is not supported in this browser/environment.")
        return
      }

      const items = await navigator.clipboard.read()
      let imageBlob: Blob | null = null

      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            imageBlob = await item.getType(type)
            break
          }
        }
        if (imageBlob) break
      }

      if (!imageBlob) {
        // Check for base64 or image URL in clipboard text
        const text = await navigator.clipboard.readText()
        if (text && (text.startsWith("data:image/") || text.match(/\.(jpeg|jpg|gif|png|webp|svg)/i))) {
          insertImageFromSrc(text)
          return
        }
        onError?.("No image found in clipboard.")
        return
      }

      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result as string
        if (src) {
          insertImageFromSrc(src)
        }
      }
      reader.onerror = () => onError?.("Failed to read image from clipboard.")
      reader.readAsDataURL(imageBlob)
    } catch (err: any) {
      console.error("Failed to paste from clipboard:", err)
      onError?.(err?.message || "Failed to read clipboard.")
    } finally {
      setLoading(false)
    }
  }

  const insertImageFromSrc = (src: string) => {
    const img = new window.Image()
    img.onload = () => {
      const { x, y, width, height } = calculateCenteredImagePosition(
        camera,
        img.naturalWidth || 400,
        img.naturalHeight || 300
      )

      addImage({
        layerId: activeLayerId,
        x,
        y,
        width,
        height,
        src,
        opacity: 1,
      })

      onSuccess?.()
    }
    img.onerror = () => {
      onError?.("Failed to decode pasted image.")
    }
    img.src = src
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handlePasteClick}
      className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white rounded-lg transition-colors group cursor-pointer disabled:opacity-50"
    >
      <span className="font-medium">{loading ? "Reading..." : "Paste from Clipboard"}</span>
      <Clipboard size={20} className="text-neutral-400 group-hover:text-white transition-colors" />
    </button>
  )
}
