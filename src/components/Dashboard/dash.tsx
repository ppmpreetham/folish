import FolderView from "./folderview";
import FolderPreview from "./folderpreview";
import New from "./new";
import Interface from "../UI/Interface";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useCanvasStore } from "../../stores/canvasStore";
import { pathDir } from "../../utils/paths";
import type { CanvasState } from "../../types";
import {
  DashboardItemData,
  DashboardRecord,
  FolderWrapper,
  Grouping,
  ItemType,
  Sorting,
  SortBy,
} from "./types";

// The Rust enums serialize as camelCase strings; these map them to/from the
// numeric TS enums the views use.
const toGrouping: Record<string, Grouping> = {
  createdAt: Grouping.CreatedAt,
  updatedAt: Grouping.UpdatedAt,
  folder: Grouping.Folder,
  none: Grouping.None,
};
const toSorting: Record<string, Sorting> = {
  dateCreated: Sorting.DateCreated,
  dateUpdated: Sorting.DateUpdated,
  alphabetical: Sorting.Alphabetical,
};
const toSortBy: Record<string, SortBy> = {
  ascending: SortBy.Ascending,
  descending: SortBy.Descending,
};
const fromGrouping: Record<Grouping, string> = {
  [Grouping.CreatedAt]: "createdAt",
  [Grouping.UpdatedAt]: "updatedAt",
  [Grouping.Folder]: "folder",
  [Grouping.None]: "none",
};
const fromSorting: Record<Sorting, string> = {
  [Sorting.DateCreated]: "dateCreated",
  [Sorting.DateUpdated]: "dateUpdated",
  [Sorting.Alphabetical]: "alphabetical",
};
const fromSortBy: Record<SortBy, string> = {
  [SortBy.Ascending]: "ascending",
  [SortBy.Descending]: "descending",
};

type ExplorerFolder = {
  type: "folder";
  name: string;
  path: string;
  config: {
    title?: string;
    desc?: string;
    layout?: {
      grouping?: { grouping: string; sortBy: string };
      sorting?: { sorting: string; sortBy: string };
    };
  } | null;
  createdAt: number;
  updatedAt: number;
};
type ExplorerFile = {
  type: "file";
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
};
type ExplorerItem = ExplorerFolder | ExplorerFile;
type CanvasDocument = { canvas: Partial<CanvasState> | null };

const FLSH_RE = /\.flsh$/i;
const baseName = (name: string) => name.replace(FLSH_RE, "");

/** sibling path + a new base filename */
const newPath = (p: string, name: string) => pathDir(p) + name;

/** First free "Base", "Base 2", ... among sibling names. */
const uniqueName = (base: string, siblings: Iterable<string>) => {
  const taken = new Set(siblings);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
};

// Items are keyed by their path, so it doubles as the id.
const toRecord = (items: ExplorerItem[], parentId: string | null): DashboardRecord =>
  Object.fromEntries(
    items.map((item) => {
      const base = { id: item.path, parentId, name: item.name };
      const entry: DashboardItemData =
        item.type === "folder"
          ? {
              ...base,
              type: ItemType.Folder,
              data: [], // children resolve on navigation
              description: item.config?.desc,
              createdAt: new Date(item.createdAt * 1000),
              updatedAt: new Date(item.updatedAt * 1000),
              grouping: item.config?.layout?.grouping && {
                grouping: toGrouping[item.config.layout.grouping.grouping] ?? Grouping.None,
                sortBy: toSortBy[item.config.layout.grouping.sortBy] ?? SortBy.Ascending,
              },
              sorting: item.config?.layout?.sorting && {
                sorting: toSorting[item.config.layout.sorting.sorting] ?? Sorting.Alphabetical,
                sortBy: toSortBy[item.config.layout.sorting.sortBy] ?? SortBy.Ascending,
              },
            }
          : {
              ...base,
              type: ItemType.Artboard,
              name: baseName(item.name),
              createdAt: new Date(item.createdAt * 1000),
              data: { drawing: "" },
            };
      return [item.path, entry];
    }),
  );

const Dashboard = () => {
  const [data, setData] = useState<DashboardRecord>({});
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bumped after creates to re-list
  const [openFile, setOpenFile] = useState<string | null>(null);
  useAutoSave(openFile);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items: ExplorerItem[] = await invoke("get_dir_contents", {
          path: currentFolderId,
        });
        const record = toRecord(items, currentFolderId);
        const paths = items.filter((i) => i.type === "file").map((f) => f.path);
        if (paths.length > 0) {
          const thumbs = await invoke<Record<string, string>>("get_thumbnails", { paths });
          for (const [id, item] of Object.entries(record)) {
            if (item.type === ItemType.Artboard) item.data.drawing = thumbs[id] ?? "";
          }
        }
        const folders = items.filter((i) => i.type === "folder").map((f) => f.path);
        if (folders.length > 0) {
          const previews = await invoke<Record<string, string[]>>("folder_previews", {
            paths: folders,
          });
          for (const [id, item] of Object.entries(record)) {
            if (item.type === ItemType.Folder) item.previews = previews[id] ?? [];
          }
        }
        if (!cancelled) setData((prev) => ({ ...prev, ...record }));
      } catch (error) {
        console.error("Failed to load folder:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // re-listing on openFile change refreshes thumbnails after an editing session
  }, [currentFolderId, version, openFile]);

  const updateFolder = (id: string, patch: Partial<FolderWrapper>) => {
    const target = data[id];
    if (target?.type !== ItemType.Folder) return;
    const next = { ...target, ...patch, updatedAt: new Date() };
    setData((prev) => ({ ...prev, [id]: next }));
    void invoke("save_folder_config", {
      path: id,
      config: {
        title: next.name,
        desc: next.description ?? null,
        layout: {
          grouping: next.grouping && {
            grouping: fromGrouping[next.grouping.grouping],
            sortBy: fromSortBy[next.grouping.sortBy],
          },
          sorting: next.sorting && {
            sorting: fromSorting[next.sorting.sorting],
            sortBy: fromSortBy[next.sorting.sortBy],
          },
        },
      },
    }).catch((error) => console.error("Failed to save folder config:", error));
  };

  const siblingNames = (type: ItemType) =>
    Object.values(data)
      .filter((item) => item.parentId === currentFolderId && item.type === type)
      .map((item) => item.name);

  const createDrawing = () =>
    void invoke("save_canvas", {
      canvas: null,
      meta: null,
      parent: currentFolderId,
      filename: uniqueName("Untitled", siblingNames(ItemType.Artboard)),
    })
      .then(() => setVersion((v) => v + 1))
      .catch((error) => console.error("Failed to create drawing:", error));

  const createFolder = () =>
    void invoke("create_folder", {
      parent: currentFolderId,
      folderName: uniqueName("New Folder", siblingNames(ItemType.Folder)),
    })
      .then(() => setVersion((v) => v + 1))
      .catch((error) => console.error("Failed to create folder:", error));

  // renames the open drawing from the editor's MenuBar (disk + local record)
  const renameOpenFile = (newName: string) => {
    if (!openFile) return;
    const name = `${newName}.flsh`;
    void invoke("rename_item", { path: openFile, newName: name })
      .then(() => {
        setOpenFile(newPath(openFile, name));
        setVersion((v) => v + 1);
      })
      .catch((error) => console.error("Failed to rename:", error));
  };

  // opens a drawing: load -> swap the editor's doc -> show the editor
  const openDrawing = (id: string) =>
    void invoke<CanvasDocument>("load_canvas", { path: id })
      .then((doc) => {
        // a brand-new file has canvas: null on disk -- load the empty state
        useCanvasStore.getState().loadDoc(doc.canvas ?? {});
        setOpenFile(id);
      })
      .catch((error) => console.error("Failed to open drawing:", error));

  const renameItem = (id: string, newName: string) => {
    const item = data[id];
    if (!item) return;
    const name = item.type === ItemType.Artboard ? `${newName}.flsh` : newName;
    void invoke("rename_item", { path: id, newName: name })
      .then(() =>
        setData((prev) => {
          if (prev[id]?.type !== item.type) return prev;
          const renamed = { ...prev[id], id: newPath(id, name), name: newName };
          delete prev[id];
          return { ...prev, [renamed.id]: renamed };
        }),
      )
      .catch((error) => console.error("Failed to rename:", error));
  };

  const rootItems = Object.values(data)
    .filter((item) => item.parentId === null)
    .map((item) => ({
      name: item.name,
      drawing: item.type === ItemType.Artboard ? item.data.drawing : item.previews?.[0] ?? "",
      onSelect:
        item.type === ItemType.Folder ? () => setCurrentFolderId(item.id) : undefined,
    }));

  if (openFile) {
    return (
      <Interface file={openFile} onBack={() => setOpenFile(null)} onRename={renameOpenFile} />
    );
  }

  return (
    <div className="p-4 bg-dash-bg text-white h-screen w-screen flex flex-row gap-8">
      <FolderPreview items={rootItems} />
      <FolderView
        currentFolderId={currentFolderId}
        setCurrentFolderId={setCurrentFolderId}
        data={data}
        onUpdateDescription={(id, description) => updateFolder(id, { description })}
        onUpdateGrouping={(id, grouping, sortBy) =>
          updateFolder(id, { grouping: { grouping, sortBy } })
        }
        onUpdateSorting={(id, sorting, sortBy) =>
          updateFolder(id, { sorting: { sorting, sortBy } })
        }
        onRename={renameItem}
        onOpen={openDrawing}
      />
      <New onNewDrawing={createDrawing} onNewFolder={createFolder} />
    </div>
  );
};

export default Dashboard;
