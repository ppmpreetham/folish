import React, { useState } from "react"
import { FileImport } from "./FileImport"
import { ClipboardImport } from "./ClipboardImport"
import { CameraImport } from "./CameraImport"

interface ImportProps {
  onClose?: () => void
}

export const Import: React.FC<ImportProps> = ({ onClose }) => {
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)

  const handleSuccess = () => {
    setFeedback({ message: "Image imported successfully", isError: false })
    setTimeout(() => {
      onClose?.()
    }, 400)
  }

  const handleError = (msg: string) => {
    setFeedback({ message: msg, isError: true })
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <div className="w-56 flex flex-col bg-neutral-900/95 backdrop-blur-xl text-neutral-100 border border-neutral-800/80 rounded-2xl p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
      <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
        Import
      </div>

      <div className="flex flex-col gap-0.5">
        <FileImport onSuccess={handleSuccess} onError={handleError} />
        <ClipboardImport onSuccess={handleSuccess} onError={handleError} />
        <CameraImport onSuccess={handleSuccess} onError={handleError} />
      </div>

      {feedback && (
        <div
          className={`mt-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-center transition-all ${
            feedback.isError
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  )
}

export default Import
export { FileImport, ClipboardImport, CameraImport }
