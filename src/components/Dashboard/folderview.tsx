import DashboardFolder from "./dashfolder";
import { useEffect, useRef, useState } from "react";
import DashboardArtboard, { RenameButton } from "./dashitem";
import Dropdown, { DropdownItem } from "./dropdown";
import {
  ItemType,
  DashboardItemData,
  FolderWrapper,
  DashboardRecord,
  Grouping,
  Sorting,
  SortBy,
} from "./types";
import {
  Folder,
  Calendar,
  TextAa,
  CalendarPlus,
  SortAscending,
  SortDescending,
  CirclesFour,
  ArrowsDownUp,
  CaretRight,
  SquaresFour,
} from "phosphor-react";

interface FolderViewProps {
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  data: DashboardRecord;
  onUpdateDescription: (id: string, newDesc: string) => void;
  onUpdateGrouping: (id: string, grouping: Grouping, sortBy: SortBy) => void;
  onUpdateSorting: (id: string, sorting: Sorting, sortBy: SortBy) => void;
  onRename: (id: string, newName: string) => void;
  onOpen: (id: string) => void;
}

type OpenDropdown = "grouping" | "sorting" | null;

const groupingLabels: Record<Grouping, string> = {
  [Grouping.None]: "None",
  [Grouping.Folder]: "Folder",
  [Grouping.CreatedAt]: "Created At",
  [Grouping.UpdatedAt]: "Updated At",
};

const sortingLabels: Record<Sorting, string> = {
  [Sorting.Alphabetical]: "Alphabetically",
  [Sorting.DateCreated]: "Date Created",
  [Sorting.DateUpdated]: "Date Updated",
};

const groupingOptions = [
  { value: Grouping.None, label: "None", icon: SquaresFour },
  { value: Grouping.Folder, label: "Folder", icon: Folder },
  { value: Grouping.CreatedAt, label: "Created At", icon: CalendarPlus },
  { value: Grouping.UpdatedAt, label: "Updated At", icon: Calendar },
];

const sortingOptions = [
  { value: Sorting.Alphabetical, label: "Alphabetically", icon: TextAa },
  { value: Sorting.DateCreated, label: "Date Created", icon: CalendarPlus },
  { value: Sorting.DateUpdated, label: "Date Updated", icon: Calendar },
];

const sortByOptions = [
  { value: SortBy.Ascending, label: "Ascending", icon: SortAscending },
  { value: SortBy.Descending, label: "Descending", icon: SortDescending },
];

const FolderView = ({
  currentFolderId,
  setCurrentFolderId,
  data,
  onUpdateDescription,
  onUpdateGrouping,
  onUpdateSorting,
  onRename,
  onOpen,
}: FolderViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const activeFolder = currentFolderId ? (data[currentFolderId] as FolderWrapper) : null;
  const visibleItems = Object.values(data).filter((item) => item.parentId === currentFolderId);
  const currentGrouping = activeFolder?.grouping?.grouping ?? Grouping.None;
  const currentGroupingSortBy = activeFolder?.grouping?.sortBy ?? SortBy.Ascending;
  const currentSorting = activeFolder?.sorting?.sorting ?? Sorting.Alphabetical;
  const currentSortingSortBy = activeFolder?.sorting?.sortBy ?? SortBy.Ascending;

  useEffect(() => {
    if (!openDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  const toggleDropdown = (dropdown: "grouping" | "sorting") => {
    setOpenDropdown((current) => (current === dropdown ? null : dropdown));
  };

  const handleDescClick = () => {
    if (!activeFolder) return;

    setEditValue(activeFolder.description ?? "");
    setIsEditing(true);
  };

  const handleDescBlur = () => {
    setIsEditing(false);

    if (currentFolderId) {
      onUpdateDescription(currentFolderId, editValue);
    }
  };

  const handleGroupingChange = (grouping: Grouping) => {
    if (!currentFolderId) return;

    onUpdateGrouping(currentFolderId, grouping, currentGroupingSortBy);

    setOpenDropdown(null);
  };

  const handleGroupingSortByChange = (sortBy: SortBy) => {
    if (!currentFolderId) return;

    onUpdateGrouping(currentFolderId, currentGrouping, sortBy);

    setOpenDropdown(null);
  };

  const handleSortingChange = (sorting: Sorting) => {
    if (!currentFolderId) return;

    onUpdateSorting(currentFolderId, sorting, currentSortingSortBy);

    setOpenDropdown(null);
  };

  const handleSortingSortByChange = (sortBy: SortBy) => {
    if (!currentFolderId) return;

    onUpdateSorting(currentFolderId, currentSorting, sortBy);

    setOpenDropdown(null);
  };

  const buildBreadcrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [];
    let currentId = currentFolderId;

    while (currentId && data[currentId]) {
      const currentItem = data[currentId];

      crumbs.unshift({
        id: currentItem.id,
        name: currentItem.name,
      });

      currentId = currentItem.parentId;
    }

    crumbs.unshift({
      id: null,
      name: "Root",
    });

    return crumbs;
  };

  const getChildArtboards = (item: DashboardItemData) => {
    if (item.type !== ItemType.Folder) return [];

    return item.data
      .map((id) => data[id])
      .filter((child) => child && child.type === ItemType.Artboard)
      .map((child) => child.data);
  };

  const childPreviews = (item: DashboardItemData) => {
    if (item.type !== ItemType.Folder) return [];
    if (item.previews?.length) return item.previews;
    return getChildArtboards(item)
      .map((a) => a.drawing)
      .filter(Boolean);
  };

  return (
    <div className="flex flex-col gap-8 flex-1 text-left">
      <div className="flex flex-col">
        <div className="flex items-center gap-1 mb-2 text-sm text-[#a0a0a0]">
          {buildBreadcrumbs().map((crumb, index, crumbs) => (
            <div key={crumb.id ?? "root"} className="flex items-center gap-1">
              <span
                className="cursor-pointer hover:text-white transition-colors"
                onClick={() => setCurrentFolderId(crumb.id)}
              >
                {crumb.name}
              </span>

              {index < crumbs.length - 1 && <CaretRight size={12} />}
            </div>
          ))}
        </div>

        <h2 className="font-bold text-2xl text-white">{activeFolder?.name ?? "My Workspace"}</h2>

        {activeFolder && (
          <div className="mt-1">
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                placeholder="Add notes here"
                onChange={(event) => setEditValue(event.target.value)}
                onBlur={handleDescBlur}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                autoFocus
                className="w-full max-w-md bg-[#2a2a2a] text-white border border-gray-500 rounded px-2 py-0.5 text-sm focus:outline-none"
              />
            ) : (
              <p
                onClick={handleDescClick}
                className="opacity-75 text-sm text-[#a0a0a0] cursor-pointer hover:text-white transition-colors select-none"
              >
                {activeFolder.description || "Add notes here"}
              </p>
            )}
          </div>
        )}

        <div ref={dropdownContainerRef} className="flex items-center gap-4">
          <Dropdown
            label={groupingLabels[currentGrouping]}
            icon={<CirclesFour size={15} />}
            isOpen={openDropdown === "grouping"}
            disabled={!currentFolderId}
            onToggle={() => toggleDropdown("grouping")}
          >
            <div className="flex flex-col gap-0.5">
              {groupingOptions.map(({ value, label, icon }) => (
                <DropdownItem
                  key={value}
                  label={label}
                  icon={icon}
                  active={value === currentGrouping}
                  onClick={() => handleGroupingChange(value)}
                />
              ))}
            </div>

            <div className="my-1 border-t border-[#454545]" />

            <div className="flex flex-col gap-0.5">
              {sortByOptions.map(({ value, label, icon }) => (
                <DropdownItem
                  key={value}
                  label={label}
                  icon={icon}
                  active={value === currentGroupingSortBy}
                  onClick={() => handleGroupingSortByChange(value)}
                />
              ))}
            </div>
          </Dropdown>

          <Dropdown
            label={sortingLabels[currentSorting]}
            icon={<ArrowsDownUp size={15} />}
            isOpen={openDropdown === "sorting"}
            disabled={!currentFolderId}
            onToggle={() => toggleDropdown("sorting")}
          >
            <div className="flex flex-col gap-0.5">
              {sortingOptions.map(({ value, label, icon }) => (
                <DropdownItem
                  key={value}
                  label={label}
                  icon={icon}
                  active={value === currentSorting}
                  onClick={() => handleSortingChange(value)}
                />
              ))}
            </div>

            <div className="my-1 border-t border-[#454545]" />

            <div className="flex flex-col gap-0.5">
              {sortByOptions.map(({ value, label, icon }) => (
                <DropdownItem
                  key={value}
                  label={label}
                  icon={icon}
                  active={value === currentSortingSortBy}
                  onClick={() => handleSortingSortByChange(value)}
                />
              ))}
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="flex flex-row flex-wrap gap-4">
        {visibleItems.map((item) => {
          if (item.type === ItemType.Folder) {
            return (
              <div key={item.id} onClick={() => setCurrentFolderId(item.id)}>
                <DashboardFolder
                  name={item.name}
                  previews={childPreviews(item)}
                  createdAt={item.createdAt}
                />
              </div>
            );
          }

          return (
            <div key={item.id} onClick={() => onOpen(item.id)}>
              <DashboardArtboard
                drawing={item.data.drawing}
                name={item.name}
                createdAt={item.createdAt}
                renameButton={
                  <RenameButton
                    currentName={item.name}
                    onRename={(newName) => onRename(item.id, newName)}
                  />
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FolderView;
