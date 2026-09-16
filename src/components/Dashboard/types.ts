// Canvas display data; identity (id/name/createdAt) lives on the wrapper.
export interface Artboard {
  drawing: string;
}

export enum ItemType {
  Artboard,
  Folder,
}

export enum Grouping {
  CreatedAt,
  UpdatedAt,
  Folder,
  None,
}
export enum Sorting {
  DateCreated,
  DateUpdated,
  Alphabetical,
}
export enum SortBy {
  Ascending,
  Descending,
}

export interface BaseWrapper {
  id: string; // Add structural unique IDs to lookups
  parentId: string | null; // null represents Root directory level
  name: string;
}

export interface ArtboardWrapper extends BaseWrapper {
  type: ItemType.Artboard;
  createdAt: Date;
  data: Artboard;
}

export interface FolderWrapper extends BaseWrapper {
  type: ItemType.Folder;
  data: string[]; // Stores array of child item IDs rather than nesting deeply
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  previews?: string[]; // child drawings for the tile collage
  grouping?: { grouping: Grouping; sortBy: SortBy };
  sorting?: { sorting: Sorting; sortBy: SortBy };
}

export type DashboardItemData = ArtboardWrapper | FolderWrapper;
export type DashboardRecord = Record<string, DashboardItemData>; // Lookups using unique IDs
