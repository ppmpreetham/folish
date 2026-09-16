import { useEffect } from "react";
import { InfiniteCanvas } from "../Canvas/InfiniteCanvas";
import { useCanvasStore } from "../../stores/canvasStore";
import ColorPicker from "./ColorPicker";
import LayersNew from "./LayersNew";
import Parameters from "./Parameters";
import MenuBar from "./Parameters/MenuBar";

export function Interface({
  file,
  onBack,
  onRename,
}: {
  file: string;
  onBack: () => void;
  onRename: (newName: string) => void;
}) {
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const deleteStrokes = useCanvasStore((state) => state.deleteStrokes);
  const setSelectedStrokes = useCanvasStore((state) => state.setSelectedStrokes);
  const showLayersPanel = useCanvasStore((state) => state.ui.showLayersPanel);
  const showPrecisionPanel = useCanvasStore((state) => state.ui.showPrecisionPanel);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Let the browser handle undo/redo in text inputs
      }

      const isZ = e.code === "KeyZ" || e.key.toLowerCase() === "z";
      const isY = e.code === "KeyY" || e.key.toLowerCase() === "y";
      const { selectedStrokeIds } = useCanvasStore.getState().ui;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedStrokeIds.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        deleteStrokes(selectedStrokeIds);
        return;
      }

      if (e.key === "Escape" && selectedStrokeIds.length > 0) {
        setSelectedStrokes([]);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (isZ && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((isZ && e.shiftKey) || (isY && !e.shiftKey)) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, deleteStrokes, setSelectedStrokes]);

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <MenuBar file={file} onBack={onBack} onRename={onRename} />
      <ColorPicker />
      <InfiniteCanvas />
      <LayersNew className={showLayersPanel ? "" : "hidden"} />
      <Parameters className={showPrecisionPanel ? "" : "hidden"} />
    </div>
  );
}

export default Interface;
