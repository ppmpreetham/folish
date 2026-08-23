import React, { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useShallow } from "zustand/react/shallow";
import {
  IconContext,
  Cursor,
  LockSimpleOpen,
  LockSimple,
  CopySimple,
  TrashSimple,
  TextAa,
  Stack,
  ArrowsDownUp,
  Plus,
  Eye,
  EyeSlash,
  DotsSixVertical,
} from "phosphor-react";
import { useCanvasStore } from "../../stores/canvasStore";
import type { Layer } from "../../types";
import Sortable, { MultiDrag } from "sortablejs";

Sortable.mount(new MultiDrag());

const ICON_CONTEXT_VALUE = {
  size: 28,
  className:
    "block w-fit p-1 rounded-md cursor-pointer hover:bg-gray-100 text-gray-700 transition-colors",
};

const LayerThumbnail = memo(({ layerId }: { layerId: string }) => {
  const layer = useCanvasStore((state) => state.doc.layers.find((l) => l.id === layerId));
  const strokes = useCanvasStore(useShallow((state) => state.getStrokesByLayer(layerId)));
  const color = useCanvasStore((state) => state.ui.activeColor);

  if (strokes.length === 0) {
    return <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded opacity-50" />;
  }

  let bounds = layer?.bounds;

  if (!bounds && strokes.length > 0) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    strokes.forEach((stroke) => {
      if (stroke.bounds) {
        minX = Math.min(minX, stroke.bounds.x);
        minY = Math.min(minY, stroke.bounds.y);
        maxX = Math.max(maxX, stroke.bounds.x + stroke.bounds.width);
        maxY = Math.max(maxY, stroke.bounds.y + stroke.bounds.height);
      }
    });

    if (minX !== Infinity) {
      bounds = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
  }

  if (!bounds || bounds.width === 0 || bounds.height === 0) {
    bounds = { x: 0, y: 0, width: 100, height: 100 };
  }

  const padding = Math.max(bounds.width, bounds.height) * 0.1;
  const viewBox = `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${
    bounds.height + padding * 2
  }`;

  return (
    <div className="w-10 h-10 bg-white border border-gray-200 rounded overflow-hidden relative">
      <svg viewBox={viewBox} className="w-full h-full pointer-events-none">
        {strokes.map((stroke) => (
          <path
            key={stroke.id}
            d={stroke.pathData}
            fill={stroke.color || color}
            opacity={stroke.opacity}
          />
        ))}
      </svg>
    </div>
  );
});
LayerThumbnail.displayName = "LayerThumbnail";

interface LayerSettingsProps {
  layer: Layer;
  position: { top: number; left: number };
  onClose: () => void;
  onRename: () => void;
}

const LayerSettings = memo(({ layer, position, onClose, onRename }: LayerSettingsProps) => {
  const settingsRef = useRef<HTMLDivElement>(null);

  const setLayerOpacity = useCanvasStore((s) => s.setLayerOpacity);
  const setLayerOpacityTransient = useCanvasStore((s) => s.setLayerOpacityTransient);
  const deleteLayer = useCanvasStore((s) => s.deleteLayer);
  const setActiveLayer = useCanvasStore((s) => s.setActiveLayer);
  const toggleLayerLock = useCanvasStore((s) => s.toggleLayerLock);
  const duplicateLayer = useCanvasStore((s) => s.duplicateLayer);
  const activeLayerId = useCanvasStore((s) => s.ui.activeLayerId);

  const [localOpacity, setLocalOpacity] = useState(Math.round(layer.opacity * 100));

  useEffect(() => {
    setLocalOpacity(Math.round(layer.opacity * 100));
  }, [layer.opacity]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={settingsRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      className="layer-settings w-fit p-2 rounded-lg flex flex-col gap-2 bg-white border border-gray-200 animate-in fade-in zoom-in-95 duration-100 min-w-50 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-row gap-1 items-center justify-between">
        <IconContext.Provider value={ICON_CONTEXT_VALUE}>
          <Cursor
            weight={activeLayerId === layer.id ? "fill" : "regular"}
            onClick={() => setActiveLayer(layer.id)}
          />

          <div onClick={() => toggleLayerLock(layer.id)}>
            {layer.locked ? <LockSimple weight="fill" /> : <LockSimpleOpen />}
          </div>

          <CopySimple
            onClick={() => {
              duplicateLayer(layer.id);
              onClose();
            }}
          />

          <TextAa
            onClick={() => {
              onRename();
              onClose();
            }}
          />

          <TrashSimple
            className="hover:bg-red-50 hover:text-red-600"
            size={20}
            onClick={() => {
              deleteLayer(layer.id);
              onClose();
            }}
          />
        </IconContext.Provider>
      </div>

      <div className="h-px bg-gray-100 w-full" />

      <div className="flex flex-row items-center gap-2 px-1">
        <input
          type="range"
          min="0"
          max="100"
          value={localOpacity}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setLocalOpacity(val);
            setLayerOpacityTransient(layer.id, val / 100);
          }}
          onMouseUp={(e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            setLayerOpacity(layer.id, val / 100);
          }}
          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer outline-none"
        />
        <div className="text-xs font-semibold text-gray-600 w-8 text-right">{localOpacity}%</div>
      </div>
    </div>
  );
});
LayerSettings.displayName = "LayerSettings";

interface SingleLayerProps {
  layer: Layer;
  isActive: boolean;
  showSettings: false | { top: number; left: number };
  onShowSettings: (id: string, pos: { top: number; left: number }) => void;
  onHideSettings: () => void;
}

const SingleLayer = memo(
  ({ layer, isActive, showSettings, onShowSettings, onHideSettings }: SingleLayerProps) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const toggleLayerVisibility = useCanvasStore((s) => s.toggleLayerVisibility);
    const renameLayer = useCanvasStore((s) => s.renameLayer);
    const setActiveLayer = useCanvasStore((s) => s.setActiveLayer);

    const handleRename = useCallback(() => {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }, []);

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        if (showSettings) {
          onHideSettings();
          return;
        }
        if (!rowRef.current) return;

        const rect = rowRef.current.getBoundingClientRect();
        const popupHeight = 120; // approximate menu height
        const safeTop = Math.min(rect.top, window.innerHeight - popupHeight - 20);

        onShowSettings(layer.id, {
          top: Math.max(16, safeTop),
          left: rect.right + 10,
        });
      },
      [showSettings, onHideSettings, onShowSettings, layer.id],
    );

    return (
      <div className="w-full relative" data-id={layer.id}>
        <div
          ref={rowRef}
          className={clsx(
            "layer-row relative flex flex-row gap-3 items-center p-2 rounded-lg cursor-pointer transition-all duration-200 border group select-none",
            isActive
              ? "bg-blue-50/50 border-blue-200 shadow-sm"
              : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200",
          )}
          onClick={() => setActiveLayer(layer.id)}
          onContextMenu={handleContextMenu}
        >
          <div
            className="drag-handle text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing px-1 flex items-center"
            style={{ touchAction: "none", userSelect: "none" }}
          >
            <DotsSixVertical size={16} weight="bold" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLayerVisibility(layer.id);
            }}
            className={clsx(
              "p-1.5 rounded-md transition-colors",
              layer.visible ? "text-gray-500 hover:text-gray-900" : "text-gray-300",
            )}
          >
            {layer.visible ? <Eye size={18} /> : <EyeSlash size={18} />}
          </button>

          <div className="shrink-0">
            <LayerThumbnail layerId={layer.id} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
            <input
              ref={inputRef}
              className={clsx(
                "text-sm font-medium bg-transparent border-none p-0 focus:ring-0 w-full truncate cursor-pointer",
                isActive ? "text-gray-900" : "text-gray-600",
              )}
              value={layer.name}
              onChange={(e) => renameLayer(layer.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => {
                setActiveLayer(layer.id);
                e.target.select();
              }}
            />
            <div className="text-[10px] text-gray-400 flex items-center gap-1 h-3">
              {Math.round(layer.opacity * 100)}%
              {layer.locked && <LockSimple size={10} weight="fill" />}
            </div>
          </div>
        </div>

        {showSettings && (
          <LayerSettings
            layer={layer}
            position={showSettings}
            onClose={onHideSettings}
            onRename={handleRename}
          />
        )}
      </div>
    );
  },
);
SingleLayer.displayName = "SingleLayer";

const LayersNew: FC<{ className?: string }> = ({ className }) => {
  const layers = useCanvasStore((state) => state.doc.layers);
  const activeLayerId = useCanvasStore((state) => state.ui.activeLayerId);
  const addLayer = useCanvasStore((state) => state.addLayer);
  const reorderLayers = useCanvasStore((state) => state.reorderLayers);
  const deleteLayer = useCanvasStore((s) => s.deleteLayer);

  const [autoSort, setAutoSort] = useState<boolean>(false);

  const [settingsState, setSettingsState] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);

  const globalDisplayLayers = useMemo(() => [...layers].reverse().map((l) => ({ ...l })), [layers]);
  const [localLayers, setLocalLayers] = useState(globalDisplayLayers);

  const localLayersRef = useRef(localLayers);
  const isDragging = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<Sortable | null>(null);
  const activeLayerIdRef = useRef(activeLayerId);

  useEffect(() => {
    localLayersRef.current = localLayers;
  }, [localLayers]);

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  useEffect(() => {
    if (!isDragging.current) {
      setLocalLayers(globalDisplayLayers);
    }
  }, [globalDisplayLayers]);

  // Create the Sortable instance once. `disabled` is toggled live via
  // `.option()` below instead of tearing the whole instance down, since
  // destroy/recreate on every autoSort flip is unnecessary work and briefly
  // drops drag listeners.
  useEffect(() => {
    if (!listRef.current) return;

    const existing = Sortable.get(listRef.current);
    if (existing) existing.destroy();

    sortableRef.current = Sortable.create(listRef.current, {
      handle: ".drag-handle",
      animation: 150,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 3,
      multiDrag: true,
      selectedClass: "multi-selected",
      onStart: () => {
        isDragging.current = true;
      },
      onEnd: (evt: any) => {
        isDragging.current = false;

        // Multi-item drag: read final order straight from the DOM, since
        // MultiDrag has already placed every selected node for us.
        if (evt.items && evt.items.length > 0) {
          const domIds = Array.from(listRef.current!.querySelectorAll("[data-id]")).map(
            (el) => (el as HTMLElement).dataset.id!,
          );
          const byId = new Map(localLayersRef.current.map((l) => [l.id, l]));
          const reordered = domIds.map((id) => byId.get(id)!).filter(Boolean);
          setLocalLayers(reordered);
          reorderLayers([...reordered].reverse());
          return;
        }

        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;

        const reordered = [...localLayersRef.current];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        setLocalLayers(reordered);
        reorderLayers([...reordered].reverse());
      },
    });

    return () => {
      sortableRef.current?.destroy();
      sortableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flip drag-enabled state without recreating the Sortable instance.
  useEffect(() => {
    sortableRef.current?.option("disabled", autoSort);
  }, [autoSort]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT") return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      const selected = listRef.current?.querySelectorAll(".multi-selected");
      if (selected && selected.length > 0) {
        selected.forEach((el) => {
          const id = (el as HTMLElement).dataset.id;
          if (id) deleteLayer(id);
        });
      } else if (activeLayerIdRef.current) {
        deleteLayer(activeLayerIdRef.current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteLayer]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        const rows = Array.from(
          listRef.current.querySelectorAll(".multi-selected"),
        ) as HTMLElement[];
        rows.forEach((el) => Sortable.utils.deselect(el));
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleShowSettings = useCallback((id: string, pos: { top: number; left: number }) => {
    setSettingsState({ id, ...pos });
  }, []);

  const handleHideSettings = useCallback(() => {
    setSettingsState(null);
  }, []);

  const handleScroll = useCallback(() => {
    setSettingsState((prev) => (prev ? null : prev));
  }, []);

  return (
    <div
      className={clsx("fixed bottom-4 left-4 flex flex-col items-start gap-2 max-w-70", className)}
    >
      <div className="flex flex-row gap-2 mb-1">
        <button
          onClick={() => setAutoSort(!autoSort)}
          className={clsx(
            "flex items-center gap-2 px-3 py-2 border rounded-lg shadow-sm transition-all text-xs font-semibold",
            autoSort
              ? "bg-gray-100 border-gray-300 text-gray-500"
              : "bg-white border-gray-200 text-gray-600 hover:text-gray-900",
          )}
        >
          <ArrowsDownUp size={16} />
          <span>{autoSort ? "Auto" : "Manual"}</span>
        </button>

        <button
          onClick={() => addLayer(`Layer ${layers.length + 1}`)}
          className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded-lg shadow-lg hover:bg-gray-800 transition-all text-xs font-semibold"
        >
          <Plus size={16} weight="bold" />
          <span>New Layer</span>
        </button>
      </div>
      <div
        className="flex flex-col w-full gap-1.5 p-1 max-h-[60vh] overflow-y-auto no-scrollbar"
        onScroll={handleScroll}
      >
        <div ref={listRef} className="flex flex-col w-full gap-1.5">
          {localLayers.map((layer) => (
            <SingleLayer
              key={layer.id}
              layer={layer}
              isActive={activeLayerId === layer.id}
              showSettings={settingsState?.id === layer.id ? settingsState : false}
              onShowSettings={handleShowSettings}
              onHideSettings={handleHideSettings}
            />
          ))}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur border border-gray-200 px-2 py-1 rounded-md text-[10px] font-bold text-gray-500 shadow-sm flex gap-2 items-center">
        <Stack size={12} />
        {layers.length} Layers
      </div>
    </div>
  );
};

export default LayersNew;
