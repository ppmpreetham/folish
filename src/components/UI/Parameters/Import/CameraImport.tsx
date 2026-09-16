import React, { useState, useRef, useEffect } from "react"
import { Camera, X, CameraRotate, Check, ArrowCounterClockwise } from "phosphor-react"
import { useCanvasStore } from "../../../../stores/canvasStore"
import { calculateCenteredImagePosition } from "./types"

interface CameraImportProps {
  onSuccess?: () => void
  onError?: (err: string) => void
}

export const CameraImport: React.FC<CameraImportProps> = ({ onSuccess, onError }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const addImage = useCanvasStore((state) => state.addImage)
  const camera = useCanvasStore((state) => state.ui.camera)
  const activeLayerId = useCanvasStore((state) => state.ui.activeLayerId)

  // Start webcam stream when modal opens
  useEffect(() => {
    if (!isModalOpen || capturedPhoto) return

    let isMounted = true

    const startCamera = async () => {
      stopCamera()
      setCameraError(null)

      try {
        // Attempt Tauri plugin call if available on mobile
        const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
        if (isTauri && (window as any).__TAURI__?.camera) {
          try {
            const photoData = await (window as any).__TAURI__.camera.takePicture()
            if (photoData && isMounted) {
              handlePhotoCaptured(photoData)
              return
            }
          } catch (tErr) {
            console.warn("Tauri camera plugin call failed or not configured, falling back to WebRTC:", tErr)
          }
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API is not supported on this device/browser.")
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Camera access error:", err)
          setCameraError(err?.message || "Failed to access camera.")
          onError?.(err?.message || "Failed to access camera.")
        }
      }
    }

    startCamera()

    return () => {
      isMounted = false
      stopCamera()
    }
  }, [isModalOpen, facingMode, capturedPhoto])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    setCapturedPhoto(dataUrl)
    stopCamera()
  }

  const handleRetake = () => {
    setCapturedPhoto(null)
  }

  const handlePhotoCaptured = (src: string) => {
    const img = new window.Image()
    img.onload = () => {
      const { x, y, width, height } = calculateCenteredImagePosition(
        camera,
        img.naturalWidth || 640,
        img.naturalHeight || 480
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

      setIsModalOpen(false)
      setCapturedPhoto(null)
      stopCamera()
      onSuccess?.()
    }
    img.onerror = () => {
      onError?.("Failed to process captured image.")
    }
    img.src = src
  }

  const handleInsert = () => {
    if (capturedPhoto) {
      handlePhotoCaptured(capturedPhoto)
    }
  }

  const handleClose = () => {
    stopCamera()
    setIsModalOpen(false)
    setCapturedPhoto(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white rounded-lg transition-colors group cursor-pointer"
      >
        <span className="font-medium">Take a Picture</span>
        <Camera size={20} className="text-neutral-400 group-hover:text-white transition-colors" />
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
                <Camera size={18} />
                <span>Take a Picture</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Viewfinder / Preview */}
            <div className="relative aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="text-center px-4 text-rose-400 text-sm">
                  {cameraError}
                </div>
              ) : capturedPhoto ? (
                <img
                  src={capturedPhoto}
                  alt="Captured Preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />
              )}

              {/* Camera Flip Button */}
              {!capturedPhoto && !cameraError && (
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
                  }
                  className="absolute top-3 right-3 p-2 bg-neutral-900/70 hover:bg-neutral-900 text-white rounded-full backdrop-blur-md border border-neutral-700/60 shadow transition-colors"
                  title="Switch Camera"
                >
                  <CameraRotate size={18} />
                </button>
              )}
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/90 border-t border-neutral-800">
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                  >
                    <ArrowCounterClockwise size={14} />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleInsert}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition-colors"
                  >
                    <Check size={14} weight="bold" />
                    <span>Insert into Canvas</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16" />
                  <button
                    type="button"
                    disabled={!!cameraError}
                    onClick={handleCapture}
                    className="w-12 h-12 rounded-full border-4 border-white/80 bg-rose-500 hover:bg-rose-400 active:scale-95 transition-transform disabled:opacity-40"
                    title="Capture Photo"
                  />
                  <div className="w-16 flex justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-xs text-neutral-400 hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
