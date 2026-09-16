import { useState, useEffect } from "react";
import { Stack, DotsNine, SquaresFour, IconContext, ArrowLeft } from "phosphor-react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { baseFileName } from "../../../utils/paths";

const MenuBar = ({
  file,
  onBack,
  onRename,
}: {
  file: string; // full path of the open drawing
  onBack: () => void;
  onRename: (newName: string) => void;
}) => {
  const showLayersPanel = useCanvasStore((state) => state.ui.showLayersPanel);
  const showPrecisionPanel = useCanvasStore((state) => state.ui.showPrecisionPanel);
  const toggleLayersPanel = useCanvasStore((state) => state.toggleLayersPanel);
  const togglePrecisionPanel = useCanvasStore((state) => state.togglePrecisionPanel);

  const [draft, setDraft] = useState(baseFileName(file));
  useEffect(() => setDraft(baseFileName(file)), [file]);
  const changed = draft.trim().length > 0 && draft.trim() !== baseFileName(file);

  return (
    <div className="flex flex-row fixed top-0 left-0 z-40 items-center bg-black/70 rounded-full m-3 px-2 py-1">
      <IconContext.Provider
        value={{
          size: 36,
          weight: "fill",
          className: "block w-fit p-2 rounded cursor-pointer text-white",
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer"
          title="Back to dashboard"
        >
          <ArrowLeft size={14} />
        </button>
        <SquaresFour />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (changed) onRename(draft.trim());
            setDraft(baseFileName(file));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(baseFileName(file));
              event.currentTarget.blur();
            }
          }}
          title="File name"
          className="outline-none bg-transparent text-white text-sm w-40 font-medium"
        />
        <Stack onClick={() => toggleLayersPanel(!showLayersPanel)} />
        <DotsNine onClick={() => togglePrecisionPanel(!showPrecisionPanel)} />
      </IconContext.Provider>
    </div>
  );
};

export default MenuBar;
