import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { produceWithPatches, applyPatches, enablePatches, Patch } from "immer"
import { getStroke } from "perfect-freehand"
import type {
  Stroke,
  Layer,
  Camera,
  Tool,
  Point,
  CanvasState,
  UIState,
  Bounds,
  SelectionLasso,
  TextShape,
  ImageShape,
  ShapeShape,
  ShapeKind,
  DashType,
  FillType,
  ShapeSize,
  FontFamilyId,
  TextAlign,
  BrushSettings,
  CanvasBackground,
  ClipboardEntry,
  ContextMenuState,
} from "../types"
import { CanvasBackgroundType, GridType } from "../types"
import { calculateStrokeBounds, expandBounds, mergeBounds } from "../utils/bounds"
import { SpatialIndex } from "../utils/spatialIndex"
import { encodePoints, decodePoints } from "../utils/b64"
import { SHAPE_STROKE_WIDTHS, getShapeBounds } from "../utils/shapes"
import { getSvgPathFromStroke } from "../utils/brushEngine"
import { BRUSHES, getBrushProperties } from "../utils/toolsData"

enablePatches()

interface PatchHistoryEntry {
  patches: Patch[]
  inversePatches: Patch[]
}

interface CanvasStore {
  doc: CanvasState
  ui: UIState
  past: PatchHistoryEntry[]
  future: PatchHistoryEntry[]
  clipboard: ClipboardEntry[]
  spatialIndex: SpatialIndex

  getActiveLayer: () => Layer | undefined
  getStrokesByLayer: (layerId: string) => Stroke[]
  queryVisibleStrokesByLayer: (viewport: Bounds) => Record<string, string[]>
  getDocBounds: () => Bounds | undefined
  getSelectionBounds: () => Bounds | undefined

  execute: (recipe: (draft: CanvasState) => void) => void
  loadDoc: (doc: Partial<CanvasState>) => void
  rebuildSpatialIndex: () => void
  queryVisibleStrokes: (viewport: Bounds) => Record<string, string[]>

  setCamera: (camera: Camera) => void
  zoomToFit: () => void
  zoomToBounds: (bounds: Bounds) => void
  zoomToSelection: () => void
  resetZoom: () => void
  zoomBy: (factor: number) => void
  setActiveTool: (tool: Tool) => void
  setActiveColor: (color: string) => void
  setActiveOpacity: (opacity: number) => void
  setActiveWidth: (width: number) => void
  setActiveLayer: (id: string) => void
  setSelectedStrokes: (ids: string[]) => void
  selectAll: () => void
  setSelectionLasso: (lasso: SelectionLasso | null) => void
  setSelectionMarquee: (marquee: Bounds | null) => void
  setSelectionTranslation: (translation: { x: number; y: number }) => void
  setSelectionScale: (scale: { x: number; y: number }) => void
  setSelectionRotation: (rotation: number) => void
  setSelectionTransformOrigin: (origin: Pick<Point, "x" | "y"> | null) => void
  setNudgePreview: (preview: { strokeId: string; pathData: string } | null) => void

  setSelectionStyle: (style: { color?: string; dash?: DashType; fill?: FillType; size?: ShapeSize }) => void
  setSelectionTextStyle: (style: {
    fontSize?: number
    fontFamily?: FontFamilyId
    textAlign?: TextAlign
    bold?: boolean
    italic?: boolean
  }) => void

  setLayerOpacityTransient: (id: string, opacity: number) => void
  setLayerOpacity: (id: string, opacity: number) => void
  toggleLayerVisibility: (id: string) => void
  toggleLayerLock: (id: string) => void
  renameLayer: (id: string, name: string) => void
  addStroke: (stroke: Omit<Stroke, "bounds"> & { timestamp?: number }) => void
  updateStrokePoints: (id: string, points: Point[]) => void
  updateStrokeGeometry: (id: string, points: Point[], pathData: string) => void
  commitShapeTransform: (
    strokeUpdates: Array<{ id: string; points: Point[]; pathData?: string }>,
    textUpdates: Array<{ id: string; x: number; y: number; width: number; height: number; rotation: number }>,
    imageUpdates?: Array<{ id: string; x: number; y: number; width: number; height: number; rotation: number }>,
    shapeUpdates?: Array<{ id: string; x: number; y: number; width: number; height: number; rotation: number }>,
  ) => void
  addText: (text: Omit<TextShape, "id" | "timestamp" | "bounds">) => void
  addTextWithId: (text: Omit<TextShape, "id" | "timestamp" | "bounds"> & { id: string }) => void
  updateText: (id: string, next: { text: string; width: number; height: number }) => void
  addImage: (image: Omit<ImageShape, "id" | "timestamp" | "bounds">) => void
  updateImage: (id: string, updates: Partial<ImageShape>) => void
  deleteImage: (id: string) => void
  addShape: (shape: Omit<ShapeShape, "id" | "timestamp" | "bounds">) => void
  updateShape: (id: string, updates: Partial<ShapeShape>) => void
  setShapeColor: (ids: string[], color: string) => void
  translateStrokes: (ids: string[], dx: number, dy: number) => void
  deleteStrokes: (ids: string[]) => void

  copySelection: () => void
  cutSelection: () => void
  pasteClipboard: () => void
  duplicateSelection: () => void
  flipSelection: (axis: "x" | "y") => void
  bringToFront: (ids: string[]) => void
  sendToBack: (ids: string[]) => void
  bringForward: (ids: string[]) => void
  sendBackward: (ids: string[]) => void

  addLayer: (name: string) => void
  deleteLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  clearLayer: (id: string) => void
  moveLayerUp: (id: string) => void
  moveLayerDown: (id: string) => void
  moveLayerTo: (fromIndex: number, toIndex: number) => void
  reorderLayers: (newLayers: Layer[]) => void

  toggleLayersPanel: (visible: boolean) => void
  togglePrecisionPanel: (visible: boolean) => void
  setSpatialIndexStatsVisible: (visible: boolean) => void
  setShowSettings: (show: boolean) => void
  setCanvasBackground: (bg: CanvasBackground) => void
  setGridType: (grid: GridType) => void
  setColorPickerOpen: (open: boolean) => void
  setColorPickerTarget: (target: "brush" | "canvasBackground") => void

  setActiveShapeKind: (kind: ShapeKind) => void
  setActiveDash: (dash: DashType) => void
  setActiveFill: (fill: FillType) => void
  setActiveShapeSize: (size: ShapeSize) => void
  setActiveFontSize: (fontSize: number) => void
  setActiveFontFamily: (family: FontFamilyId) => void
  setActiveTextAlign: (align: TextAlign) => void
  setSnapToGrid: (enabled: boolean) => void
  setContextMenu: (menu: ContextMenuState | null) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  resetCanvas: () => void
  clearHistory: () => void

  setSidebarOpen: (open: boolean) => void
  setEditingOption: (option: number | null) => void
  setActiveSmooth: (smooth: number) => void
  setActiveBrush: (brushId: string) => void
  setSlotAssignment: (slotIndex: number, assignment: import("../types").SlotAssignment) => void
}

const initialDoc: CanvasState = {
  layers: [
    {
      id: "layer-1",
      name: "Layer 1",
      visible: true,
      locked: false,
      opacity: 1,
      strokeIds: [],
      shapeIds: [],
      textIds: [],
      imageIds: [],
      bounds: undefined,
    },
  ],
  strokes: {},
  shapes: {},
  texts: {},
  images: {},
}

const DEFAULT_BRUSH_CONFIGS: Record<string, Partial<BrushSettings>> = {
  pen: { color: "#000000", width: 3, opacity: 1, smooth: 0.45 },
  fountain: { color: "#000000", width: 4, opacity: 1, smooth: 0.35 },
  "dynamic-pen": { color: "#000000", width: 5, opacity: 1, smooth: 0.4 },
  "fixed-width": { color: "#000000", width: 2, opacity: 1, smooth: 0.25 },
  wire: { color: "#000000", width: 1, opacity: 0.85, smooth: 0.1 },
  "soft-pencil": { color: "#000000", width: 5, opacity: 0.7, smooth: 0.8 },
  "hard-pencil": { color: "#000000", width: 2, opacity: 0.9, smooth: 0.2 },
  marker: { color: "#000000", width: 24, opacity: 0.6, smooth: 0.65 },
  watercolor: { color: "#000000", width: 32, opacity: 0.35, smooth: 0.9 },
  airbrush: { color: "#000000", width: 45, opacity: 0.25, smooth: 0.95 },
  fill: { color: "#000000", width: 0, opacity: 1, smooth: 0.5 },
  dotted: { color: "#000000", width: 6, opacity: 0.9, smooth: 0.5 },
}

const createInitialBrushSettings = (): Record<string, BrushSettings> =>
  Object.fromEntries(
    BRUSHES.map((brush) => {
      const custom = DEFAULT_BRUSH_CONFIGS[brush.id]
      return [
        brush.id,
        {
          color: custom?.color ?? "#000000",
          width: custom?.width ?? 2,
          opacity: custom?.opacity ?? 1,
          smooth: custom?.smooth ?? brush.properties.smoothing,
        },
      ]
    }),
  )

const initialUI: UIState = {
  camera: { x: 0, y: 0, zoom: 1, rotation: 0 },
  activeTool: "pen",
  activeColor: "#000000",
  activeWidth: 3,
  activeOpacity: 1,
  activeLayerId: "layer-1",
  showLayersPanel: true,
  showPrecisionPanel: true,
  showSpatialIndexStats: false,
  showSettings: false,
  sidebarOpen: false,
  editingOption: null,
  activeSmooth: 0.45,
  activeBrush: "pen",
  brushSettings: createInitialBrushSettings(),
  canvasBackground: { type: CanvasBackgroundType.White, color: "#ffffff" },
  gridType: GridType.None,
  colorPickerOpen: false,
  colorPickerTarget: "brush",
  toolSlots: {
    0: { type: "brush", id: "pen" },
    1: { type: "brush", id: "fill" },
    2: { type: "tool", id: "selection" },
    3: { type: "tool", id: "marquee" },
    4: { type: "tool", id: "text" },
    5: { type: "tool", id: "nudge" },
    6: { type: "tool", id: "pan" },
    9: { type: "tool", id: "rotate" },
  },
  selectedStrokeIds: [],
  selectionLasso: null,
  selectionMarquee: null,
  selectionTranslation: { x: 0, y: 0 },
  selectionScale: { x: 1, y: 1 },
  selectionRotation: 0,
  selectionTransformOrigin: null,
  nudgePreview: null,
  activeShapeKind: "rect",
  activeDash: "solid",
  activeFill: "none",
  activeShapeSize: "m",
  activeFontSize: 24,
  activeFontFamily: "draw",
  activeTextAlign: "left",
  snapToGrid: false,
  contextMenu: null,
}

const MAX_HISTORY = 50

const selectionEquals = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index])

const selectionLassoEquals = (a: SelectionLasso | null, b: SelectionLasso | null) =>
  a === b ||
  (!!a && !!b && a.points.length === b.points.length && a.points.every((point, index) =>
    point.x === b.points[index].x && point.y === b.points[index].y,
  ))

const recalculateLayerBounds = (doc: CanvasState, layerId: string) => {
  const layer = doc.layers.find((candidate) => candidate.id === layerId)
  if (!layer) return

  let nextBounds: Bounds | undefined
  for (const strokeId of layer.strokeIds) {
    const bounds = doc.strokes[strokeId]?.bounds
    if (!bounds) continue
    nextBounds = nextBounds ? mergeBounds(nextBounds, bounds) : bounds
  }
  for (const shapeId of layer.shapeIds ?? []) {
    const bounds = doc.shapes?.[shapeId]?.bounds
    if (!bounds) continue
    nextBounds = nextBounds ? mergeBounds(nextBounds, bounds) : bounds
  }
  for (const textId of layer.textIds ?? []) {
    const bounds = doc.texts[textId]?.bounds
    if (!bounds) continue
    nextBounds = nextBounds ? mergeBounds(nextBounds, bounds) : bounds
  }
  for (const imgId of layer.imageIds ?? []) {
    const bounds = doc.images?.[imgId]?.bounds
    if (!bounds) continue
    nextBounds = nextBounds ? mergeBounds(nextBounds, bounds) : bounds
  }
  layer.bounds = nextBounds
}

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    persist(
      (set, get) => ({
        doc: initialDoc,
        ui: initialUI,
        past: [],
        future: [],
        clipboard: [],
        spatialIndex: new SpatialIndex(),

        getActiveLayer: () => {
          const { doc, ui } = get()
          return doc.layers.find((l) => l.id === ui.activeLayerId)
        },

        getStrokesByLayer: (layerId: string) => {
          const { doc } = get()
          const layer = doc.layers.find((l) => l.id === layerId)
          if (!layer) return []
          return layer.strokeIds.map((id) => doc.strokes[id]).filter((s): s is Stroke => !!s)
        },

        getDocBounds: () => {
          const { doc } = get()
          let bounds: Bounds | undefined
          for (const layer of doc.layers) {
            if (!layer.visible) continue
            const layerBounds = layer.bounds
            if (!layerBounds) continue
            bounds = bounds ? mergeBounds(bounds, layerBounds) : layerBounds
          }
          return bounds
        },

        getSelectionBounds: () => {
          const { doc, ui } = get()
          let bounds: Bounds | undefined
          for (const id of ui.selectedStrokeIds) {
            const next =
              doc.strokes[id]?.bounds ?? doc.shapes?.[id]?.bounds ?? doc.texts[id]?.bounds ?? doc.images?.[id]?.bounds
            if (!next) continue
            bounds = bounds ? mergeBounds(bounds, next) : next
          }
          return bounds
        },

        queryVisibleStrokes: (viewport) => {
          return get().spatialIndex.query(viewport)
        },

        rebuildSpatialIndex: () => {
          const { doc, spatialIndex } = get()
          spatialIndex.buildFromStrokes(doc.strokes, doc.texts, doc.images ?? {}, doc.shapes ?? {})
        },

        setCamera: (camera) => set((state) => ({ ui: { ...state.ui, camera } })),

        zoomToBounds: (bounds) => {
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          const padding = 96
          const zoom = Math.min(
            8,
            Math.max(
              0.1,
              Math.min(
                (viewportWidth - padding * 2) / Math.max(bounds.width, 1),
                (viewportHeight - padding * 2) / Math.max(bounds.height, 1),
              ),
            ),
          )
          get().setCamera({
            ...get().ui.camera,
            zoom,
            x: viewportWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
            y: viewportHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
          })
        },

        zoomToFit: () => {
          const bounds = get().getDocBounds()
          if (!bounds || (bounds.width === 0 && bounds.height === 0)) {
            get().resetZoom()
            return
          }
          get().zoomToBounds(bounds)
        },

        zoomToSelection: () => {
          const bounds = get().getSelectionBounds()
          if (!bounds) return
          get().zoomToBounds(bounds)
        },

        resetZoom: () => {
          const cam = get().ui.camera
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          const centerX = viewportWidth / 2
          const centerY = viewportHeight / 2
          const worldX = (centerX - cam.x) / cam.zoom
          const worldY = (centerY - cam.y) / cam.zoom
          get().setCamera({ ...cam, zoom: 1, x: centerX - worldX, y: centerY - worldY })
        },

        zoomBy: (factor) => {
          const cam = get().ui.camera
          const viewportWidth = window.innerWidth
          const viewportHeight = window.innerHeight
          const centerX = viewportWidth / 2
          const centerY = viewportHeight / 2
          const worldX = (centerX - cam.x) / cam.zoom
          const worldY = (centerY - cam.y) / cam.zoom
          const zoom = Math.min(50, Math.max(0.1, cam.zoom * factor))
          get().setCamera({ ...cam, zoom, x: centerX - worldX * zoom, y: centerY - worldY * zoom })
        },
        setActiveTool: (tool) => set((state) => ({ ui: { ...state.ui, activeTool: tool } })),
        setActiveColor: (color) => {
          set((state) => ({
            ui: {
              ...state.ui,
              activeColor: color,
              brushSettings: {
                ...state.ui.brushSettings,
                ...(state.ui.activeBrush
                  ? { [state.ui.activeBrush]: { ...state.ui.brushSettings[state.ui.activeBrush], color } }
                  : {}),
              },
            },
          }))

          const state = get()
          const selectedTextIds = state.ui.selectedStrokeIds.filter((id) => !!state.doc.texts[id])
          const selectedShapeIds = state.ui.selectedStrokeIds.filter(
            (id) => !!state.doc.shapes?.[id] && !selectedTextIds.includes(id),
          )
          if (selectedTextIds.length > 0 || selectedShapeIds.length > 0) {
            state.execute((draft) => {
              selectedTextIds.forEach((id) => {
                if (draft.texts[id]) {
                  draft.texts[id].color = color
                }
              })
              selectedShapeIds.forEach((id) => {
                if (draft.shapes?.[id]) {
                  draft.shapes[id].color = color
                }
              })
            })
          }
        },
        setActiveOpacity: (opacity: number) =>
          set((state) => ({
            ui: {
              ...state.ui,
              activeOpacity: opacity,
              brushSettings: {
                ...state.ui.brushSettings,
                [state.ui.activeBrush]: { ...state.ui.brushSettings[state.ui.activeBrush], opacity },
              },
            },
          })),
        setActiveWidth: (width) => set((state) => ({
          ui: {
            ...state.ui,
            activeWidth: width,
            brushSettings: {
              ...state.ui.brushSettings,
              [state.ui.activeBrush]: { ...state.ui.brushSettings[state.ui.activeBrush], width },
            },
          },
        })),
        setActiveLayer: (id) => set((state) => ({ ui: { ...state.ui, activeLayerId: id } })),
        setSelectedStrokes: (ids) => {
          const nextIds = Array.from(new Set(ids))
          if (selectionEquals(get().ui.selectedStrokeIds, nextIds)) return
          set((state) => ({ ui: { ...state.ui, selectedStrokeIds: nextIds } }))
        },
        selectAll: () => {
          const { doc } = get()
          const ids: string[] = []
          for (const layer of doc.layers) {
            if (!layer.visible || layer.locked) continue
            ids.push(...layer.strokeIds)
            ids.push(...(layer.shapeIds ?? []))
            ids.push(...(layer.textIds ?? []))
            ids.push(...(layer.imageIds ?? []))
          }
          get().setSelectedStrokes(ids)
        },
        setSelectionLasso: (lasso) => {
          if (selectionLassoEquals(get().ui.selectionLasso, lasso)) return
          set((state) => ({ ui: { ...state.ui, selectionLasso: lasso } }))
        },
        setSelectionMarquee: (marquee) => {
          const current = get().ui.selectionMarquee
          if (
            current === marquee ||
            (!!current && !!marquee && current.x === marquee.x && current.y === marquee.y && current.width === marquee.width && current.height === marquee.height)
          ) return
          set((state) => ({ ui: { ...state.ui, selectionMarquee: marquee } }))
        },
        setSelectionTranslation: (translation) => {
          const current = get().ui.selectionTranslation
          if (current.x === translation.x && current.y === translation.y) return
          set((state) => ({ ui: { ...state.ui, selectionTranslation: translation } }))
        },
        setSelectionScale: (scale) => {
          const current = get().ui.selectionScale
          if (current.x === scale.x && current.y === scale.y) return
          set((state) => ({ ui: { ...state.ui, selectionScale: scale } }))
        },
        setSelectionRotation: (rotation) => {
          if (get().ui.selectionRotation === rotation) return
          set((state) => ({ ui: { ...state.ui, selectionRotation: rotation } }))
        },
        setSelectionTransformOrigin: (origin) => {
          const current = get().ui.selectionTransformOrigin
          if (current?.x === origin?.x && current?.y === origin?.y) return
          set((state) => ({ ui: { ...state.ui, selectionTransformOrigin: origin } }))
        },
        setNudgePreview: (preview) => {
          const current = get().ui.nudgePreview
          if (current?.strokeId === preview?.strokeId && current?.pathData === preview?.pathData) return
          set((state) => ({ ui: { ...state.ui, nudgePreview: preview } }))
        },

        setLayerOpacityTransient: (id: string, opacity: number) =>
          set((state) => {
            const newLayers = state.doc.layers.map((l) =>
              l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l,
            )
            return { doc: { ...state.doc, layers: newLayers } }
          }),

        execute: (recipe) => {
          const [nextDoc, patches, inversePatches] = produceWithPatches(get().doc, recipe)
          set((state) => ({
            doc: nextDoc,
            past: [...state.past, { patches, inversePatches }].slice(-MAX_HISTORY),
            future: [],
          }))
        },

        // replaces the whole document (opening a file): fresh history, fresh index
        loadDoc: (doc) => {
          const next: CanvasState = {
            ...initialDoc,
            ...doc,
            strokes: doc.strokes ?? {},
            shapes: doc.shapes ?? {},
            texts: doc.texts ?? {},
            images: doc.images ?? {},
          }
          set({
            doc: next,
            past: [],
            future: [],
            ui: { ...get().ui, activeLayerId: next.layers[0]?.id ?? get().ui.activeLayerId, selectedStrokeIds: [] },
          })
          get().spatialIndex.clear()
          get().rebuildSpatialIndex()
        },

        addStroke: (stroke) => {
          const rawBounds = calculateStrokeBounds(stroke.points)
          const strokeBounds = expandBounds(rawBounds, stroke.width * 2)
          const strokeWithBounds = {
            ...stroke,
            timestamp: stroke.timestamp ?? Date.now(),
            bounds: strokeBounds,
            pointsCompressed: encodePoints(stroke.points),
          }

          if (strokeWithBounds.bounds) {
            get().spatialIndex.insert(stroke.id, stroke.layerId, strokeWithBounds.bounds)
          }

          get().execute((draft) => {
            draft.strokes[stroke.id] = strokeWithBounds

            const layer = draft.layers.find((l) => l.id === stroke.layerId)
            if (layer) {
              layer.strokeIds.push(stroke.id)
              if (!layer.bounds) {
                layer.bounds = strokeBounds
              } else {
                layer.bounds = mergeBounds(layer.bounds, strokeBounds)
              }
            }
          })
        },

        updateStrokePoints: (id, points) => {
          const stroke = get().doc.strokes[id]
          if (!stroke) return

          const rawBounds = calculateStrokeBounds(points)
          const newBounds = expandBounds(rawBounds, stroke.width * 2)

          get().execute((draft) => {
            const draftStroke = draft.strokes[id]
            if (draftStroke) {
              draftStroke.points = [...points]
              draftStroke.bounds = newBounds
            }
          })

          get().spatialIndex.remove(id)
          get().spatialIndex.insert(id, stroke.layerId, newBounds)
        },

        updateStrokeGeometry: (id, points, pathData) => {
          const stroke = get().doc.strokes[id]
          if (!stroke) return
          const localBounds = expandBounds(calculateStrokeBounds(points), stroke.width * 2)
          const nextBounds = {
            ...localBounds,
            x: localBounds.x + (stroke.offset?.x ?? 0),
            y: localBounds.y + (stroke.offset?.y ?? 0),
          }
          get().execute((draft) => {
            const draftStroke = draft.strokes[id]
            if (!draftStroke) return
            draftStroke.points = [...points]
            draftStroke.pointsCompressed = encodePoints(points)
            draftStroke.pathData = pathData
            draftStroke.bounds = nextBounds
            recalculateLayerBounds(draft, draftStroke.layerId)
          })
          get().spatialIndex.remove(id)
          get().spatialIndex.insert(id, stroke.layerId, nextBounds)
        },

        commitShapeTransform: (strokeUpdates, textUpdates, imageUpdates = [], shapeUpdates = []) => {
          if (
            strokeUpdates.length === 0 &&
            textUpdates.length === 0 &&
            imageUpdates.length === 0 &&
            shapeUpdates.length === 0
          )
            return
          const state = get()
          const affectedLayerIds = new Set<string>()
          const nextStrokeBounds = new Map<string, Bounds>()
          const nextTextBounds = new Map<string, Bounds>()
          const nextImageBounds = new Map<string, Bounds>()
          const nextShapeBounds = new Map<string, Bounds>()
          for (const update of strokeUpdates) {
            const stroke = state.doc.strokes[update.id]
            if (!stroke) continue
            const localBounds = expandBounds(calculateStrokeBounds(update.points), stroke.width * 2)
            nextStrokeBounds.set(update.id, {
              ...localBounds,
              x: localBounds.x + (stroke.offset?.x ?? 0),
              y: localBounds.y + (stroke.offset?.y ?? 0),
            })
            affectedLayerIds.add(stroke.layerId)
          }
          for (const update of textUpdates) {
            const text = state.doc.texts[update.id]
            if (!text) continue
            nextTextBounds.set(update.id, { x: update.x, y: update.y, width: update.width, height: update.height })
            affectedLayerIds.add(text.layerId)
          }
          for (const update of imageUpdates) {
            const img = state.doc.images?.[update.id]
            if (!img) continue
            nextImageBounds.set(update.id, { x: update.x, y: update.y, width: update.width, height: update.height })
            affectedLayerIds.add(img.layerId)
          }
          for (const update of shapeUpdates) {
            const shape = state.doc.shapes?.[update.id]
            if (!shape) continue
            const strokeWidth = SHAPE_STROKE_WIDTHS[shape.size]
            nextShapeBounds.set(
              update.id,
              getShapeBounds(update.x, update.y, update.width, update.height, strokeWidth),
            )
            affectedLayerIds.add(shape.layerId)
          }
          for (const [id, bounds] of nextStrokeBounds) {
            const stroke = state.doc.strokes[id]
            if (!stroke) continue
            state.spatialIndex.remove(id)
            state.spatialIndex.insert(id, stroke.layerId, bounds)
          }
          for (const [id, bounds] of nextTextBounds) {
            const text = state.doc.texts[id]
            if (!text) continue
            state.spatialIndex.remove(id)
            state.spatialIndex.insert(id, text.layerId, bounds)
          }
          for (const [id, bounds] of nextImageBounds) {
            const img = state.doc.images?.[id]
            if (!img) continue
            state.spatialIndex.remove(id)
            state.spatialIndex.insert(id, img.layerId, bounds)
          }
          for (const [id, bounds] of nextShapeBounds) {
            const shape = state.doc.shapes?.[id]
            if (!shape) continue
            state.spatialIndex.remove(id)
            state.spatialIndex.insert(id, shape.layerId, bounds)
          }
          state.execute((draft) => {
            for (const update of strokeUpdates) {
              const stroke = draft.strokes[update.id]
              const bounds = nextStrokeBounds.get(update.id)
              if (!stroke || !bounds) continue
              stroke.points = [...update.points]
              stroke.pointsCompressed = encodePoints(update.points)
              stroke.pathData = update.pathData
              stroke.bounds = bounds
            }
            for (const update of textUpdates) {
              const text = draft.texts[update.id]
              const bounds = nextTextBounds.get(update.id)
              if (!text || !bounds) continue
              text.x = update.x - (text.offset?.x ?? 0)
              text.y = update.y - (text.offset?.y ?? 0)
              text.width = update.width
              text.height = update.height
              text.rotation = update.rotation
              text.bounds = bounds
            }
            for (const update of imageUpdates) {
              if (!draft.images) continue
              const img = draft.images[update.id]
              const bounds = nextImageBounds.get(update.id)
              if (!img || !bounds) continue
              img.x = update.x - (img.offset?.x ?? 0)
              img.y = update.y - (img.offset?.y ?? 0)
              img.width = update.width
              img.height = update.height
              img.rotation = update.rotation
              img.bounds = bounds
            }
            for (const update of shapeUpdates) {
              if (!draft.shapes) continue
              const shape = draft.shapes[update.id]
              const bounds = nextShapeBounds.get(update.id)
              if (!shape || !bounds) continue
              shape.x = update.x - (shape.offset?.x ?? 0)
              shape.y = update.y - (shape.offset?.y ?? 0)
              shape.width = update.width
              shape.height = update.height
              shape.rotation = update.rotation
              shape.bounds = bounds
            }
            affectedLayerIds.forEach((layerId) => recalculateLayerBounds(draft, layerId))
          })
        },

        addText: (text) => {
          get().addTextWithId({ ...text, id: crypto.randomUUID() })
        },

        addTextWithId: (text) => {
          const { id, ...rest } = text
          const bounds = { x: rest.x, y: rest.y, width: rest.width, height: rest.height }
          const textShape: TextShape = { ...rest, id, bounds, timestamp: Date.now() }

          get().spatialIndex.insert(id, textShape.layerId, bounds)

          get().execute((draft) => {
            draft.texts[id] = textShape
            const layer = draft.layers.find((candidate) => candidate.id === textShape.layerId)
            if (!layer) return
            ;(layer.textIds ??= []).push(id)
            layer.bounds = layer.bounds ? mergeBounds(layer.bounds, bounds) : bounds
          })
          get().setSelectedStrokes([id])
        },

        updateText: (id, next) => {
          const text = get().doc.texts[id]
          if (!text) return
          if (text.text === next.text && text.width === next.width && text.height === next.height) return
          const bounds = { ...text.bounds, width: next.width, height: next.height }

          get().spatialIndex.remove(id)
          get().spatialIndex.insert(id, text.layerId, bounds)

          get().execute((draft) => {
            const draftText = draft.texts[id]
            if (!draftText) return
            draftText.text = next.text
            draftText.width = next.width
            draftText.height = next.height
            draftText.bounds = bounds
            recalculateLayerBounds(draft, draftText.layerId)
          })
        },

        addImage: (image) => {
          const id = crypto.randomUUID()
          const bounds = { x: image.x, y: image.y, width: image.width, height: image.height }
          const imageShape: ImageShape = { ...image, id, bounds, timestamp: Date.now() }

          get().spatialIndex.insert(id, image.layerId, bounds)

          get().execute((draft) => {
            draft.images = draft.images || {}
            draft.images[id] = imageShape
            const layer = draft.layers.find((candidate) => candidate.id === image.layerId)
            if (!layer) return
            ;(layer.imageIds ??= []).push(id)
            layer.bounds = layer.bounds ? mergeBounds(layer.bounds, bounds) : bounds
          })
          get().setSelectedStrokes([id])
        },

        updateImage: (id, updates) => {
          const image = get().doc.images?.[id]
          if (!image) return
          const nextWidth = updates.width ?? image.width
          const nextHeight = updates.height ?? image.height
          const nextX = updates.x ?? image.x
          const nextY = updates.y ?? image.y
          const bounds = { x: nextX, y: nextY, width: nextWidth, height: nextHeight }
          get().execute((draft) => {
            if (!draft.images?.[id]) return
            Object.assign(draft.images[id], updates, { bounds })
            recalculateLayerBounds(draft, draft.images[id].layerId)
          })
          get().spatialIndex.remove(id)
          get().spatialIndex.insert(id, image.layerId, bounds)
        },

        deleteImage: (id) => {
          const image = get().doc.images?.[id]
          if (!image) return
          get().execute((draft) => {
            if (draft.images?.[id]) {
              delete draft.images[id]
              const layer = draft.layers.find((candidate) => candidate.id === image.layerId)
              if (layer && layer.imageIds) {
                layer.imageIds = layer.imageIds.filter((imgId) => imgId !== id)
                recalculateLayerBounds(draft, layer.id)
              }
            }
          })
          get().spatialIndex.remove(id)
        },

        addShape: (shape) => {
          const id = crypto.randomUUID()
          const strokeWidth = SHAPE_STROKE_WIDTHS[shape.size]
          const bounds = getShapeBounds(shape.x, shape.y, shape.width, shape.height, strokeWidth)
          const shapeShape: ShapeShape = { ...shape, id, bounds, timestamp: Date.now() }

          get().spatialIndex.insert(id, shape.layerId, bounds)

          get().execute((draft) => {
            draft.shapes = draft.shapes || {}
            draft.shapes[id] = shapeShape
            const layer = draft.layers.find((candidate) => candidate.id === shape.layerId)
            if (!layer) return
            ;(layer.shapeIds ??= []).push(id)
            layer.bounds = layer.bounds ? mergeBounds(layer.bounds, bounds) : bounds
          })
          get().setSelectedStrokes([id])
        },

        updateShape: (id, updates) => {
          const shape = get().doc.shapes?.[id]
          if (!shape) return
          const nextWidth = updates.width ?? shape.width
          const nextHeight = updates.height ?? shape.height
          const nextX = updates.x ?? shape.x
          const nextY = updates.y ?? shape.y
          const nextSize = updates.size ?? shape.size
          const strokeWidth = SHAPE_STROKE_WIDTHS[nextSize]
          const bounds = getShapeBounds(nextX, nextY, nextWidth, nextHeight, strokeWidth)
          get().execute((draft) => {
            if (!draft.shapes?.[id]) return
            Object.assign(draft.shapes[id], updates, { bounds })
            recalculateLayerBounds(draft, draft.shapes[id].layerId)
          })
          get().spatialIndex.remove(id)
          get().spatialIndex.insert(id, shape.layerId, bounds)
        },

        setShapeColor: (ids, color) => {
          const targetIds = ids.filter((id) => {
            const stroke = get().doc.strokes[id]
            const text = get().doc.texts[id]
            const shape = get().doc.shapes?.[id]
            return (stroke?.color ?? text?.color ?? shape?.color) !== color
          })
          if (targetIds.length === 0) return
          get().execute((draft) => {
            for (const id of targetIds) {
              if (draft.strokes[id]) draft.strokes[id].color = color
              if (draft.texts[id]) draft.texts[id].color = color
              if (draft.shapes?.[id]) draft.shapes[id].color = color
            }
          })
        },

        translateStrokes: (ids, dx, dy) => {
          if (ids.length === 0 || (dx === 0 && dy === 0)) return

          const movedStrokes = ids
            .map((id) => get().doc.strokes[id])
            .filter((stroke): stroke is Stroke => !!stroke && !!stroke.bounds)
          const movedShapes = ids
            .map((id) => get().doc.shapes?.[id])
            .filter((shape): shape is ShapeShape => !!shape)
          const movedTexts = ids
            .map((id) => get().doc.texts[id])
            .filter((text): text is TextShape => !!text)
          const movedImages = ids
            .map((id) => get().doc.images?.[id])
            .filter((img): img is ImageShape => !!img)
          if (
            movedStrokes.length === 0 &&
            movedShapes.length === 0 &&
            movedTexts.length === 0 &&
            movedImages.length === 0
          )
            return

          const affectedLayerIds = new Set([
            ...movedStrokes.map((stroke) => stroke.layerId),
            ...movedShapes.map((shape) => shape.layerId),
            ...movedTexts.map((text) => text.layerId),
            ...movedImages.map((img) => img.layerId),
          ])

          get().execute((draft) => {
            for (const stroke of movedStrokes) {
              const draftStroke = draft.strokes[stroke.id]
              if (!draftStroke?.bounds) continue
              draftStroke.offset = {
                x: (draftStroke.offset?.x ?? 0) + dx,
                y: (draftStroke.offset?.y ?? 0) + dy,
              }
              draftStroke.bounds = {
                ...draftStroke.bounds,
                x: draftStroke.bounds.x + dx,
                y: draftStroke.bounds.y + dy,
              }
            }
            for (const shape of movedShapes) {
              const draftShape = draft.shapes?.[shape.id]
              if (!draftShape) continue
              draftShape.offset = {
                x: (draftShape.offset?.x ?? 0) + dx,
                y: (draftShape.offset?.y ?? 0) + dy,
              }
              draftShape.bounds = {
                ...draftShape.bounds,
                x: draftShape.bounds.x + dx,
                y: draftShape.bounds.y + dy,
              }
            }
            for (const text of movedTexts) {
              const draftText = draft.texts[text.id]
              if (!draftText) continue
              draftText.offset = {
                x: (draftText.offset?.x ?? 0) + dx,
                y: (draftText.offset?.y ?? 0) + dy,
              }
              draftText.bounds = {
                ...draftText.bounds,
                x: draftText.bounds.x + dx,
                y: draftText.bounds.y + dy,
              }
            }
            for (const img of movedImages) {
              const draftImg = draft.images?.[img.id]
              if (!draftImg) continue
              draftImg.offset = {
                x: (draftImg.offset?.x ?? 0) + dx,
                y: (draftImg.offset?.y ?? 0) + dy,
              }
              draftImg.bounds = {
                ...draftImg.bounds,
                x: draftImg.bounds.x + dx,
                y: draftImg.bounds.y + dy,
              }
            }
            affectedLayerIds.forEach((layerId) => recalculateLayerBounds(draft, layerId))
          })

          for (const stroke of movedStrokes) {
            const nextBounds = get().doc.strokes[stroke.id]?.bounds
            if (!nextBounds) continue
            get().spatialIndex.remove(stroke.id)
            get().spatialIndex.insert(stroke.id, stroke.layerId, nextBounds)
          }
          for (const text of movedTexts) {
            const nextBounds = get().doc.texts[text.id]?.bounds
            if (!nextBounds) continue
            get().spatialIndex.remove(text.id)
            get().spatialIndex.insert(text.id, text.layerId, nextBounds)
          }
          for (const shape of movedShapes) {
            const nextBounds = get().doc.shapes?.[shape.id]?.bounds
            if (!nextBounds) continue
            get().spatialIndex.remove(shape.id)
            get().spatialIndex.insert(shape.id, shape.layerId, nextBounds)
          }
          for (const img of movedImages) {
            const nextBounds = get().doc.images?.[img.id]?.bounds
            if (!nextBounds) continue
            get().spatialIndex.remove(img.id)
            get().spatialIndex.insert(img.id, img.layerId, nextBounds)
          }
        },

        queryVisibleStrokesByLayer: (viewport: Bounds) => {
          return get().spatialIndex.query(viewport)
        },

        deleteStrokes: (ids) => {
          if (ids.length === 0) return

          get().spatialIndex.removeBatch(ids)

          get().execute((draft) => {
            ids.forEach((id) => {
              delete draft.strokes[id]
              delete draft.texts[id]
              if (draft.shapes) delete draft.shapes[id]
              if (draft.images) delete draft.images[id]
            })

            draft.layers.forEach((layer) => {
              layer.strokeIds = layer.strokeIds.filter((sid) => !ids.includes(sid))
              layer.shapeIds = (layer.shapeIds ?? []).filter((shapeId) => !ids.includes(shapeId))
              layer.textIds = (layer.textIds ?? []).filter((textId) => !ids.includes(textId))
              layer.imageIds = (layer.imageIds ?? []).filter((imgId) => !ids.includes(imgId))

              recalculateLayerBounds(draft, layer.id)
            })
          })

          get().setSelectedStrokes(
            get().ui.selectedStrokeIds.filter((selectedId) => !ids.includes(selectedId)),
          )
        },

        copySelection: () => {
          const { doc, ui } = get()
          const entries: ClipboardEntry[] = []
          for (const id of ui.selectedStrokeIds) {
            if (doc.strokes[id]) entries.push({ kind: "stroke", stroke: { ...doc.strokes[id] } })
            else if (doc.shapes?.[id]) entries.push({ kind: "shape", shape: { ...doc.shapes[id] } })
            else if (doc.texts[id]) entries.push({ kind: "text", text: { ...doc.texts[id] } })
            else if (doc.images?.[id]) entries.push({ kind: "image", image: { ...doc.images[id] } })
          }
          set({ clipboard: entries })
        },

        cutSelection: () => {
          get().copySelection()
          get().deleteStrokes(get().ui.selectedStrokeIds)
        },

        pasteClipboard: () => {
          const { clipboard, ui } = get()
          if (clipboard.length === 0) return
          const dx = 16
          const dy = 16
          const newIds: string[] = []

          get().execute((draft) => {
            const activeLayer = draft.layers.find((candidate) => candidate.id === ui.activeLayerId)
            const targetLayerId =
              activeLayer && !activeLayer.locked ? activeLayer.id : draft.layers[0]?.id
            const targetLayer = draft.layers.find((candidate) => candidate.id === targetLayerId)
            if (!targetLayer) return
            const layer = targetLayer

            for (const entry of clipboard) {
              if (entry.kind === "stroke") {
                const id = crypto.randomUUID()
                draft.strokes[id] = {
                  ...entry.stroke,
                  id,
                  layerId: targetLayer.id,
                  offset: { x: (entry.stroke.offset?.x ?? 0) + dx, y: (entry.stroke.offset?.y ?? 0) + dy },
                  bounds: entry.stroke.bounds
                    ? { ...entry.stroke.bounds, x: entry.stroke.bounds.x + dx, y: entry.stroke.bounds.y + dy }
                    : undefined,
                }
                layer.strokeIds.push(id)
                newIds.push(id)
              } else if (entry.kind === "shape") {
                const id = crypto.randomUUID()
                if (!draft.shapes) draft.shapes = {}
                draft.shapes[id] = {
                  ...entry.shape,
                  id,
                  layerId: targetLayer.id,
                  offset: { x: (entry.shape.offset?.x ?? 0) + dx, y: (entry.shape.offset?.y ?? 0) + dy },
                  bounds: { ...entry.shape.bounds, x: entry.shape.bounds.x + dx, y: entry.shape.bounds.y + dy },
                }
                ;(layer.shapeIds ??= []).push(id)
                newIds.push(id)
              } else if (entry.kind === "text") {
                const id = crypto.randomUUID()
                draft.texts[id] = {
                  ...entry.text,
                  id,
                  layerId: targetLayer.id,
                  offset: { x: (entry.text.offset?.x ?? 0) + dx, y: (entry.text.offset?.y ?? 0) + dy },
                  bounds: { ...entry.text.bounds, x: entry.text.bounds.x + dx, y: entry.text.bounds.y + dy },
                }
                ;(layer.textIds ??= []).push(id)
                newIds.push(id)
              } else {
                const id = crypto.randomUUID()
                if (!draft.images) draft.images = {}
                draft.images[id] = {
                  ...entry.image,
                  id,
                  layerId: targetLayer.id,
                  offset: { x: (entry.image.offset?.x ?? 0) + dx, y: (entry.image.offset?.y ?? 0) + dy },
                  bounds: { ...entry.image.bounds, x: entry.image.bounds.x + dx, y: entry.image.bounds.y + dy },
                }
                ;(layer.imageIds ??= []).push(id)
                newIds.push(id)
              }
            }
            recalculateLayerBounds(draft, targetLayer.id)
          })

          // Sync spatial index for pasted entries.
          const doc = get().doc
          for (const id of newIds) {
            const bounds =
              doc.strokes[id]?.bounds ?? doc.shapes?.[id]?.bounds ?? doc.texts[id]?.bounds ?? doc.images?.[id]?.bounds
            const layerId = doc.strokes[id]?.layerId ?? doc.shapes?.[id]?.layerId ?? doc.texts[id]?.layerId ?? doc.images?.[id]?.layerId
            if (bounds && layerId) get().spatialIndex.insert(id, layerId, bounds)
          }
          get().setSelectedStrokes(newIds)
        },

        duplicateSelection: () => {
          if (get().ui.selectedStrokeIds.length === 0) return
          get().copySelection()
          get().pasteClipboard()
        },

        flipSelection: (axis) => {
          const { doc, ui } = get()
          const ids = ui.selectedStrokeIds
          if (ids.length === 0) return

          // Strokes: mirror points numerically around their own bounds center.
          const strokeUpdates: Array<{ id: string; points: Point[]; pathData?: string }> = []
          for (const id of ids) {
            const stroke = doc.strokes[id]
            if (!stroke || !stroke.bounds || stroke.points.length === 0) continue
            const offsetX = stroke.offset?.x ?? 0
            const offsetY = stroke.offset?.y ?? 0
            const cx = stroke.bounds.x + stroke.bounds.width / 2 - offsetX
            const cy = stroke.bounds.y + stroke.bounds.height / 2 - offsetY
            const points = stroke.points.map((point) => ({
              ...point,
              x: axis === "x" ? 2 * cx - point.x : point.x,
              y: axis === "y" ? 2 * cy - point.y : point.y,
            }))
            const pathData =
              stroke.tool === "fill"
                ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`
                : getSvgPathFromStroke(
                    getStroke(points, { ...getBrushProperties(stroke.tool), size: stroke.width }),
                  )
            strokeUpdates.push({ id, points, pathData })
          }
          if (strokeUpdates.length > 0) {
            get().execute((draft) => {
              for (const update of strokeUpdates) {
                const stroke = draft.strokes[update.id]
                if (!stroke) continue
                stroke.points = update.points
                stroke.pointsCompressed = encodePoints(update.points)
                stroke.pathData = update.pathData
                const localBounds = expandBounds(calculateStrokeBounds(update.points), stroke.width * 2)
                stroke.bounds = {
                  ...localBounds,
                  x: localBounds.x + (stroke.offset?.x ?? 0),
                  y: localBounds.y + (stroke.offset?.y ?? 0),
                }
              }
            })
            for (const update of strokeUpdates) {
              const stroke = get().doc.strokes[update.id]
              if (!stroke?.bounds) continue
              get().spatialIndex.remove(update.id)
              get().spatialIndex.insert(update.id, stroke.layerId, stroke.bounds)
            }
          }

          // Shapes / texts / images: mirror via flip flags.
          const flaggedIds = ids.filter(
            (id) => !!(doc.shapes?.[id] || doc.texts[id] || doc.images?.[id]),
          )
          if (flaggedIds.length > 0) {
            get().execute((draft) => {
              for (const id of flaggedIds) {
                if (draft.shapes?.[id]) {
                  draft.shapes[id].flipX = axis === "x" ? !draft.shapes[id].flipX : draft.shapes[id].flipX
                  draft.shapes[id].flipY = axis === "y" ? !draft.shapes[id].flipY : draft.shapes[id].flipY
                }
                if (draft.texts[id]) {
                  draft.texts[id].flipX = axis === "x" ? !draft.texts[id].flipX : draft.texts[id].flipX
                  draft.texts[id].flipY = axis === "y" ? !draft.texts[id].flipY : draft.texts[id].flipY
                }
                if (draft.images?.[id]) {
                  draft.images[id].flipX = axis === "x" ? !draft.images[id].flipX : draft.images[id].flipX
                  draft.images[id].flipY = axis === "y" ? !draft.images[id].flipY : draft.images[id].flipY
                }
              }
            })
          }
        },

        bringToFront: (ids) => {
          if (ids.length === 0) return
          const idSet = new Set(ids)
          get().execute((draft) => {
            draft.layers.forEach((layer) => {
              const reorder = (list: string[] | undefined) => {
                if (!list || !list.some((id) => idSet.has(id))) return
                const picked = list.filter((id) => idSet.has(id))
                const rest = list.filter((id) => !idSet.has(id))
                list.length = 0
                list.push(...rest, ...picked)
              }
              reorder(layer.strokeIds)
              reorder(layer.shapeIds)
              reorder(layer.textIds)
              reorder(layer.imageIds)
            })
          })
        },

        sendToBack: (ids) => {
          if (ids.length === 0) return
          const idSet = new Set(ids)
          get().execute((draft) => {
            draft.layers.forEach((layer) => {
              const reorder = (list: string[] | undefined) => {
                if (!list || !list.some((id) => idSet.has(id))) return
                const picked = list.filter((id) => idSet.has(id))
                const rest = list.filter((id) => !idSet.has(id))
                list.length = 0
                list.push(...picked, ...rest)
              }
              reorder(layer.strokeIds)
              reorder(layer.shapeIds)
              reorder(layer.textIds)
              reorder(layer.imageIds)
            })
          })
        },

        bringForward: (ids) => {
          if (ids.length === 0) return
          const idSet = new Set(ids)
          get().execute((draft) => {
            draft.layers.forEach((layer) => {
              const reorder = (list: string[] | undefined) => {
                if (!list || !list.some((id) => idSet.has(id))) return
                for (let i = list.length - 2; i >= 0; i--) {
                  if (idSet.has(list[i]) && !idSet.has(list[i + 1])) {
                    const temp = list[i]
                    list[i] = list[i + 1]
                    list[i + 1] = temp
                  }
                }
              }
              reorder(layer.strokeIds)
              reorder(layer.shapeIds)
              reorder(layer.textIds)
              reorder(layer.imageIds)
            })
          })
        },

        sendBackward: (ids) => {
          if (ids.length === 0) return
          const idSet = new Set(ids)
          get().execute((draft) => {
            draft.layers.forEach((layer) => {
              const reorder = (list: string[] | undefined) => {
                if (!list || !list.some((id) => idSet.has(id))) return
                for (let i = 1; i < list.length; i++) {
                  if (idSet.has(list[i]) && !idSet.has(list[i - 1])) {
                    const temp = list[i]
                    list[i] = list[i - 1]
                    list[i - 1] = temp
                  }
                }
              }
              reorder(layer.strokeIds)
              reorder(layer.shapeIds)
              reorder(layer.textIds)
              reorder(layer.imageIds)
            })
          })
        },

        setSelectionStyle: ({ color, dash, fill, size }) => {
          const { ui, doc } = get()
          const ids = ui.selectedStrokeIds
          const hasStrokeTargets = ids.some((id) => !!doc.strokes[id])
          const hasShapeTargets = ids.some((id) => !!doc.shapes?.[id])
          const hasTextTargets = ids.some((id) => !!doc.texts[id])
          const needsExecute =
            (color !== undefined && (hasStrokeTargets || hasShapeTargets || hasTextTargets)) ||
            ((dash !== undefined || fill !== undefined || size !== undefined) && hasShapeTargets)
          if (needsExecute) {
            get().execute((draft) => {
              for (const id of ids) {
                if (color !== undefined && draft.strokes[id]) draft.strokes[id].color = color
                if (color !== undefined && draft.texts[id]) draft.texts[id].color = color
                if (draft.shapes?.[id]) {
                  if (color !== undefined) draft.shapes[id].color = color
                  if (dash !== undefined) draft.shapes[id].dash = dash
                  if (fill !== undefined) draft.shapes[id].fill = fill
                  if (size !== undefined) {
                    draft.shapes[id].size = size
                    const shape = draft.shapes[id]
                    shape.bounds = getShapeBounds(
                      shape.x,
                      shape.y,
                      shape.width,
                      shape.height,
                      SHAPE_STROKE_WIDTHS[size],
                    )
                  }
                }
              }
            })
            // Refresh spatial index for shapes whose bounds changed with size.
            const nextDoc = get().doc
            for (const id of ids) {
              const shape = nextDoc.shapes?.[id]
              if (shape && size !== undefined) {
                get().spatialIndex.remove(id)
                get().spatialIndex.insert(id, shape.layerId, shape.bounds)
              }
            }
          }
          if (color !== undefined && ids.length === 0) {
            // No selection: update the active paint color for the next shape.
          }
        },

        setSelectionTextStyle: (style) => {
          const { ui, doc } = get()
          const textIds = ui.selectedStrokeIds.filter((id) => !!doc.texts[id])
          if (textIds.length === 0) return
          get().execute((draft) => {
            for (const id of textIds) {
              Object.assign(draft.texts[id], style)
            }
          })
        },

        addLayer: (name) => {
          const id = crypto.randomUUID()
          get().execute((draft) => {
            draft.layers.push({
              id,
              name,
              visible: true,
              locked: false,
              opacity: 1,
              strokeIds: [],
              textIds: [],
              bounds: undefined,
            })
          })
          get().setActiveLayer(id)
        },

        deleteLayer: (id) => {
          if (get().doc.layers.length <= 1) return

          const layer = get().doc.layers.find((l) => l.id === id)
          if (layer) {
            get().spatialIndex.removeBatch([
              ...layer.strokeIds,
              ...(layer.shapeIds ?? []),
              ...(layer.textIds ?? []),
              ...(layer.imageIds ?? []),
            ])
          }

          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer) {
              layer.strokeIds.forEach((sid) => {
                delete draft.strokes[sid]
              })
              ;(layer.shapeIds ?? []).forEach((shapeId) => {
                if (draft.shapes) delete draft.shapes[shapeId]
              })
              ;(layer.textIds ?? []).forEach((textId) => {
                delete draft.texts[textId]
              })
              ;(layer.imageIds ?? []).forEach((imgId) => {
                if (draft.images) delete draft.images[imgId]
              })
            }
            draft.layers = draft.layers.filter((l) => l.id !== id)
          })

          if (get().ui.activeLayerId === id) {
            get().setActiveLayer(get().doc.layers[0].id)
          }
        },

        toggleLayerVisibility: (id) =>
          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer) layer.visible = !layer.visible
          }),

        setLayerOpacity: (id, opacity) =>
          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer) layer.opacity = Math.max(0, Math.min(1, opacity))
          }),

        renameLayer: (id, name) =>
          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer) layer.name = name.trim() || "Layer"
          }),

        moveLayerUp: (id: string) => {
          get().execute((draft) => {
            const index = draft.layers.findIndex((l) => l.id === id)
            if (index < draft.layers.length - 1 && index !== -1) {
              const temp = draft.layers[index]
              draft.layers[index] = draft.layers[index + 1]
              draft.layers[index + 1] = temp
            }
          })
        },

        moveLayerDown: (id: string) => {
          get().execute((draft) => {
            const index = draft.layers.findIndex((l) => l.id === id)
            if (index > 0) {
              const temp = draft.layers[index]
              draft.layers[index] = draft.layers[index - 1]
              draft.layers[index - 1] = temp
            }
          })
        },

        moveLayerTo: (fromIndex: number, toIndex: number) => {
          get().execute((draft) => {
            if (
              fromIndex >= 0 &&
              fromIndex < draft.layers.length &&
              toIndex >= 0 &&
              toIndex < draft.layers.length
            ) {
              const layer = draft.layers.splice(fromIndex, 1)[0]
              draft.layers.splice(toIndex, 0, layer)
            }
          })
        },

        reorderLayers: (newLayers: Layer[]) => {
          get().execute((draft) => {
            draft.layers = newLayers
          })
        },

        toggleLayerLock: (id) =>
          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer) layer.locked = !layer.locked
          }),

        duplicateLayer: (id) => {
          const sourceLayer = get().doc.layers.find((l) => l.id === id)
          if (!sourceLayer) return

          const newLayerId = crypto.randomUUID()
          const newStrokeIds: string[] = []
          const newStrokesMap: Record<string, Stroke> = {}
          const newShapeIds: string[] = []
          const newShapesMap: Record<string, ShapeShape> = {}
          const newTextIds: string[] = []
          const newTextsMap: Record<string, TextShape> = {}
          const newImageIds: string[] = []
          const newImagesMap: Record<string, ImageShape> = {}

          sourceLayer.strokeIds.forEach((strokeId) => {
            const sourceStroke = get().doc.strokes[strokeId]
            if (sourceStroke) {
              const newStrokeId = crypto.randomUUID()
              newStrokesMap[newStrokeId] = {
                ...sourceStroke,
                id: newStrokeId,
                layerId: newLayerId,
              }
              newStrokeIds.push(newStrokeId)
            }
          })

          ;(sourceLayer.shapeIds ?? []).forEach((shapeId) => {
            const sourceShape = get().doc.shapes?.[shapeId]
            if (!sourceShape) return
            const newShapeId = crypto.randomUUID()
            newShapesMap[newShapeId] = { ...sourceShape, id: newShapeId, layerId: newLayerId }
            newShapeIds.push(newShapeId)
          })

          ;(sourceLayer.textIds ?? []).forEach((textId) => {
            const sourceText = get().doc.texts[textId]
            if (!sourceText) return
            const newTextId = crypto.randomUUID()
            newTextsMap[newTextId] = { ...sourceText, id: newTextId, layerId: newLayerId }
            newTextIds.push(newTextId)
          })

          ;(sourceLayer.imageIds ?? []).forEach((imageId) => {
            const sourceImage = get().doc.images?.[imageId]
            if (!sourceImage) return
            const newImageId = crypto.randomUUID()
            newImagesMap[newImageId] = { ...sourceImage, id: newImageId, layerId: newLayerId }
            newImageIds.push(newImageId)
          })

          get().execute((draft) => {
            const index = draft.layers.findIndex((l) => l.id === id)
            if (index === -1) return

            Object.entries(newStrokesMap).forEach(([id, stroke]) => {
              draft.strokes[id] = stroke
            })
            if (!draft.shapes) draft.shapes = {}
            Object.entries(newShapesMap).forEach(([id, shape]) => {
              draft.shapes[id] = shape
            })
            Object.entries(newTextsMap).forEach(([id, text]) => {
              draft.texts[id] = text
            })
            if (!draft.images) draft.images = {}
            Object.entries(newImagesMap).forEach(([id, img]) => {
              draft.images[id] = img
            })

            const newLayer: Layer = {
              ...sourceLayer,
              id: newLayerId,
              name: `${sourceLayer.name} (Copy)`,
              strokeIds: newStrokeIds,
              shapeIds: newShapeIds,
              textIds: newTextIds,
              imageIds: newImageIds,
              bounds: sourceLayer.bounds,
            }

            draft.layers.splice(index + 1, 0, newLayer)
          })

          Object.entries(newStrokesMap).forEach(([id, stroke]) => {
            if (stroke.bounds) {
              get().spatialIndex.insert(id, stroke.layerId, stroke.bounds)
            }
          })
          Object.entries(newShapesMap).forEach(([id, shape]) => {
            get().spatialIndex.insert(id, shape.layerId, shape.bounds)
          })
          Object.entries(newTextsMap).forEach(([id, text]) => {
            get().spatialIndex.insert(id, text.layerId, text.bounds)
          })
          Object.entries(newImagesMap).forEach(([id, img]) => {
            get().spatialIndex.insert(id, img.layerId, img.bounds)
          })
        },

        clearLayer: (id: string) => {
          const layer = get().doc.layers.find((l) => l.id === id)
          if (!layer) return
          const toRemove = [...layer.strokeIds, ...(layer.textIds ?? []), ...(layer.imageIds ?? [])]
          get().deleteStrokes(toRemove)
        },

        toggleLayersPanel: (visible: boolean) => {
          set((state) => ({ ui: { ...state.ui, showLayersPanel: visible } }))
        },

        togglePrecisionPanel: (visible: boolean) => {
          set((state) => ({ ui: { ...state.ui, showPrecisionPanel: visible } }))
        },
        setSpatialIndexStatsVisible: (visible) => {
          set((state) => ({ ui: { ...state.ui, showSpatialIndexStats: visible } }))
        },
        setShowSettings: (show) => {
          set((state) => ({ ui: { ...state.ui, showSettings: show } }))
        },
        setCanvasBackground: (bg) => {
          set((state) => ({ ui: { ...state.ui, canvasBackground: bg } }))
        },
        setGridType: (grid) => {
          set((state) => ({ ui: { ...state.ui, gridType: grid } }))
        },
        setColorPickerOpen: (open) => {
          set((state) => ({ ui: { ...state.ui, colorPickerOpen: open } }))
        },
        setColorPickerTarget: (target) => {
          set((state) => ({ ui: { ...state.ui, colorPickerTarget: target } }))
        },

        setActiveShapeKind: (kind) => {
          set((state) => ({ ui: { ...state.ui, activeShapeKind: kind, activeTool: kind } }))
        },
        setActiveDash: (dash) => {
          set((state) => ({ ui: { ...state.ui, activeDash: dash } }))
        },
        setActiveFill: (fill) => {
          set((state) => ({ ui: { ...state.ui, activeFill: fill } }))
        },
        setActiveShapeSize: (size) => {
          set((state) => ({ ui: { ...state.ui, activeShapeSize: size } }))
        },
        setActiveFontSize: (fontSize) => {
          set((state) => ({ ui: { ...state.ui, activeFontSize: fontSize } }))
        },
        setActiveFontFamily: (family) => {
          set((state) => ({ ui: { ...state.ui, activeFontFamily: family } }))
        },
        setActiveTextAlign: (align) => {
          set((state) => ({ ui: { ...state.ui, activeTextAlign: align } }))
        },
        setSnapToGrid: (enabled) => {
          set((state) => ({ ui: { ...state.ui, snapToGrid: enabled } }))
        },
        setContextMenu: (menu) => {
          set((state) => ({ ui: { ...state.ui, contextMenu: menu } }))
        },

        setSidebarOpen: (open: boolean) => {
          set((state) => ({ ui: { ...state.ui, sidebarOpen: open } }))
        },

        setEditingOption: (option: number | null) => {
          set((state) => ({ ui: { ...state.ui, editingOption: option } }))
        },

        setActiveSmooth: (smooth: number) => {
          set((state) => {
            const activeSmooth = Math.max(0, Math.min(1, smooth))
            return {
              ui: {
                ...state.ui,
                activeSmooth,
                brushSettings: {
                  ...state.ui.brushSettings,
                  [state.ui.activeBrush]: { ...state.ui.brushSettings[state.ui.activeBrush], smooth: activeSmooth },
                },
              },
            }
          })
        },

        setActiveBrush: (brushId: string) => {
          set((state) => {
            const settings = state.ui.brushSettings[brushId] ?? createInitialBrushSettings()[brushId]
            return {
              ui: {
                ...state.ui,
                activeBrush: brushId,
                ...(settings
                  ? {
                      activeColor: settings.color,
                      activeWidth: settings.width,
                      activeOpacity: settings.opacity,
                      activeSmooth: settings.smooth,
                    }
                  : {}),
                brushSettings: {
                  ...state.ui.brushSettings,
                  ...(settings ? { [brushId]: settings } : {}),
                },
              },
            }
          })
        },

        setSlotAssignment: (slotIndex: number, assignment: import("../types").SlotAssignment) => {
          set((state) => ({
            ui: {
              ...state.ui,
              toolSlots: {
                ...state.ui.toolSlots,
                [slotIndex]: assignment,
              },
            },
          }))
        },

        undo: () => {
          const { past, doc } = get()
          if (past.length === 0) return
          const entry = past[past.length - 1]
          set((state) => ({
            doc: applyPatches(doc, entry.inversePatches),
            past: state.past.slice(0, -1),
            future: [entry, ...state.future],
          }))
          get().rebuildSpatialIndex()
        },

        redo: () => {
          const { future, doc } = get()
          if (future.length === 0) return
          const entry = future[0]
          set((state) => ({
            doc: applyPatches(doc, entry.patches),
            past: [...state.past, entry],
            future: state.future.slice(1),
          }))
          get().rebuildSpatialIndex()
        },

        canUndo: () => get().past.length > 0,
        canRedo: () => get().future.length > 0,

        resetCanvas: () => {
          set({ doc: initialDoc, ui: initialUI, past: [], future: [] })
          get().spatialIndex.clear()
        },

        clearHistory: () => set({ past: [], future: [] }),
      }),
      {
        name: "folish-storage",
        partialize: (state) => ({
          doc: {
            ...state.doc,
            strokes: Object.fromEntries(
              Object.entries(state.doc.strokes).map(([id, stroke]) => {
                const { points, ...rest } = stroke
                return [
                  id,
                  {
                    ...rest,
                    pointsCompressed: stroke.pointsCompressed || encodePoints(stroke.points),
                  },
                ]
              }),
            ),
          },
        }),
        version: 2,

        onRehydrateStorage: () => (state) => {
          if (state) {
            state.doc.texts ??= {}
            state.doc.images ??= {}
            state.doc.shapes ??= {}
            state.doc.layers.forEach((layer) => {
              layer.textIds ??= []
              layer.imageIds ??= []
              layer.shapeIds ??= []
            })
            state.ui.canvasBackground ??= { type: CanvasBackgroundType.White, color: "#ffffff" }
            state.ui.gridType ??= GridType.None
            state.ui.showSettings ??= false
            state.ui.activeShapeKind ??= "rect"
            state.ui.activeDash ??= "solid"
            state.ui.activeFill ??= "none"
            state.ui.activeShapeSize ??= "m"
            state.ui.activeFontSize ??= 24
            state.ui.activeFontFamily ??= "draw"
            state.ui.activeTextAlign ??= "left"
            state.ui.snapToGrid ??= false
            state.ui.contextMenu = null
            Object.values(state.doc.strokes).forEach((stroke) => {
              if (stroke.pointsCompressed && !stroke.points) {
                stroke.points = decodePoints(stroke.pointsCompressed)
              }
            })
            const activeExists = state.doc.layers.some((l) => l.id === state.ui.activeLayerId)
            if (!activeExists && state.doc.layers.length > 0) {
              state.ui.activeLayerId = state.doc.layers[0].id
            }

            state.spatialIndex = new SpatialIndex()
            state.rebuildSpatialIndex()
          }
        },
      },
    ),
  ),
)
