import React, { useRef } from "react";
import { File } from "phosphor-react";
import { useCanvasStore } from "../../../../stores/canvasStore";
import { calculateCenteredImagePosition } from "./types";

interface FileImportProps {
  onSuccess?: () => void;
  onError?: (err: string) => void;
}

export const FileImport: React.FC<FileImportProps> = ({ onSuccess, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addImage = useCanvasStore((state) => state.addImage);
  const camera = useCanvasStore((state) => state.ui.camera);
  const activeLayerId = useCanvasStore((state) => state.ui.activeLayerId);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError?.("Selected file is not an image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const src = loadEvent.target?.result as string;
      if (!src) return;

      const img = new window.Image();
      img.onload = () => {
        const { x, y, width, height } = calculateCenteredImagePosition(
          camera,
          img.naturalWidth || 400,
          img.naturalHeight || 300,
        );

        addImage({
          layerId: activeLayerId,
          x,
          y,
          width,
          height,
          src,
          opacity: 1,
        });

        onSuccess?.();
      };
      img.onerror = () => {
        onError?.("Failed to decode selected image.");
      };
      img.src = src;
    };

    reader.onerror = () => {
      onError?.("Failed to read image file.");
    };

    reader.readAsDataURL(file);
    // Reset file input value so selecting the same file again triggers change
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleButtonClick}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white rounded-lg transition-colors group cursor-pointer"
      >
        <span className="font-medium">Files</span>
        <File size={20} className="text-neutral-400 group-hover:text-white transition-colors" />
      </button>
    </>
  );
};
