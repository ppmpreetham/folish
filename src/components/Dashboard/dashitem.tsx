import { useState } from "react";
import { PencilSimple, Check, File } from "phosphor-react";
import type { ReactNode } from "react";
import { Artboard } from "./types";

const dateString = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Inline rename: pencil reveals an input; Enter/blur/✓ commits, Esc cancels. */
export const RenameButton = ({
  currentName,
  onRename,
}: {
  currentName: string;
  onRename: (newName: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentName);
  const trimmed = draft.trim();
  const changed = trimmed !== currentName && trimmed.length > 0;

  if (!editing) {
    return (
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[#a0a0a0] hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          setDraft(currentName);
          setEditing(true);
        }}
        title="Rename"
      >
        <PencilSimple size={14} />
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (changed) onRename(trimmed);
  };

  return (
    <span className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setEditing(false);
        }}
        className="w-28 bg-[#2a2a2a] text-white border border-gray-500 rounded px-1 text-xs focus:outline-none"
      />
      <button
        onClick={commit}
        disabled={!changed}
        className={changed ? "cursor-pointer text-white" : "text-[#555]"}
        title="Confirm"
      >
        <Check size={14} />
      </button>
    </span>
  );
};

const DashboardArtboard = ({
  drawing,
  name,
  createdAt,
  renameButton,
}: Artboard & { renameButton?: ReactNode }) => (
  <div className="w-64 flex flex-col group cursor-pointer select-none text-left">
    <div className="w-full h-48 bg-dash-bg rounded-xl border border-transparent group-hover:border-gray-500 transition-all">
      <div className="w-full h-full bg-white rounded-lg overflow-hidden flex items-center justify-center">
        {drawing ? (
          <img src={drawing} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white" />
        )}
      </div>
    </div>

    <div className="mt-2 px-1 text-sm text-white">
      <div className="font-semibold leading-tight truncate">{name}</div>
      <div className="text-[#a0a0a0] text-xs flex items-center gap-1.5 mt-0.5">
        <span>{dateString(createdAt)}</span>
        <File size={16} weight="fill" />
        {renameButton}
      </div>
    </div>
  </div>
);

export default DashboardArtboard;
