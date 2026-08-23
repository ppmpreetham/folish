import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { produceWithPatches, applyPatches, enablePatches, Patch } from "immer"
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
} from "../types"
import { calculateStrokeBounds, expandBounds, mergeBounds } from "../utils/bounds"
import { SpatialIndex } from "../utils/spatialIndex"
import { encodePoints, decodePoints } from "../utils/b64"

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
  spatialIndex: SpatialIndex

  getActiveLayer: () => Layer | undefined
  getStrokesByLayer: (layerId: string) => Stroke[]
  queryVisibleStrokes: (viewport: Bounds) => Record<string, string[]>
  rebuildSpatialIndex: () => void
  queryVisibleStrokesByLayer: (viewport: Bounds) => Record<string, string[]>

  setCamera: (camera: Camera) => void
  setActiveTool: (tool: Tool) => void
  setActiveColor: (color: string) => void
  setActiveOpacity: (opacity: number) => void
  setActiveWidth: (width: number) => void
  setActiveLayer: (id: string) => void
  setLayerOpacityTransient: (id: string, opacity: number) => void
  setSelectedStrokes: (ids: string[]) => void
  setSelectionLasso: (lasso: SelectionLasso | null) => void
  setSelectionMarquee: (marquee: Bounds | null) => void
  setSelectionTranslation: (translation: { x: number; y: number }) => void
  setNudgePreview: (preview: { strokeId: string; pathData: string } | null) => void

  execute: (recipe: (draft: CanvasState) => void) => void
  addStroke: (stroke: Stroke) => void
  addText: (text: Omit<TextShape, "id" | "bounds" | "timestamp">) => void
  updateText: (id: string, text: Pick<TextShape, "text" | "width" | "height">) => void
  setShapeColor: (ids: string[], color: string) => void
  updateStrokePoints: (id: string, points: Point[]) => void
  updateStrokeGeometry: (id: string, points: Point[], pathData: string) => void
  translateStrokes: (ids: string[], dx: number, dy: number) => void
  deleteStrokes: (ids: string[]) => void

  addLayer: (name: string) => void
  deleteLayer: (id: string) => void
  toggleLayerVisibility: (id: string) => void
  setLayerOpacity: (id: string, opacity: number) => void
  renameLayer: (id: string, name: string) => void
  toggleLayerLock: (id: string) => void
  duplicateLayer: (id: string) => void
  moveLayerUp: (id: string) => void
  moveLayerDown: (id: string) => void
  moveLayerTo: (fromIndex: number, toIndex: number) => void
  reorderLayers: (newLayers: Layer[]) => void

  toggleLayersPanel: (visible: boolean) => void
  togglePrecisionPanel: (visible: boolean) => void

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
      textIds: [],
      bounds: undefined,
    },
  ],
  strokes: {},
  texts: {},
}

const initialUI: UIState = {
  camera: { x: 0, y: 0, zoom: 1, rotation: 0 },
  activeTool: "pen",
  activeColor: "#000000",
  activeWidth: 2,
  activeOpacity: 1,
  activeLayerId: "layer-1",
  showLayersPanel: true,
  showPrecisionPanel: true,
  sidebarOpen: false,
  editingOption: null,
  activeSmooth: 0.5,
  activeBrush: "pen",
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
  nudgePreview: null,
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
  for (const textId of layer.textIds ?? []) {
    const bounds = doc.texts[textId]?.bounds
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
        spatialIndex: new SpatialIndex(),

        getActiveLayer: () => {
          const { doc, ui } = get()
          return doc.layers.find((l) => l.id === ui.activeLayerId)
        },

        getStrokesByLayer: (layerId) => {
          const { doc } = get()
          const layer = doc.layers.find((l) => l.id === layerId)
          if (!layer) return []
          return layer.strokeIds.map((id) => doc.strokes[id]).filter((s): s is Stroke => !!s)
        },

        queryVisibleStrokes: (viewport) => {
          return get().spatialIndex.query(viewport)
        },

        rebuildSpatialIndex: () => {
          const { doc, spatialIndex } = get()
          spatialIndex.buildFromStrokes(doc.strokes, doc.texts)
        },

        setCamera: (camera) => set((state) => ({ ui: { ...state.ui, camera } })),
        setActiveTool: (tool) => set((state) => ({ ui: { ...state.ui, activeTool: tool } })),
        setActiveColor: (color) => set((state) => ({ ui: { ...state.ui, activeColor: color } })),
        setActiveOpacity: (opacity: number) =>
          set((state) => ({ ui: { ...state.ui, activeOpacity: opacity } })),
        setActiveWidth: (width) => set((state) => ({ ui: { ...state.ui, activeWidth: width } })),
        setActiveLayer: (id) => set((state) => ({ ui: { ...state.ui, activeLayerId: id } })),
        setSelectedStrokes: (ids) => {
          const nextIds = Array.from(new Set(ids))
          if (selectionEquals(get().ui.selectedStrokeIds, nextIds)) return
          set((state) => ({ ui: { ...state.ui, selectedStrokeIds: nextIds } }))
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

        addStroke: (stroke) => {
          const rawBounds = calculateStrokeBounds(stroke.points)
          const strokeBounds = expandBounds(rawBounds, stroke.width * 2)
          const strokeWithBounds = {
            ...stroke,
            bounds: strokeBounds,
            pointsCompressed: encodePoints(stroke.points),
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

          if (strokeWithBounds.bounds) {
            get().spatialIndex.insert(stroke.id, stroke.layerId, strokeWithBounds.bounds)
          }
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

        addText: (text) => {
          const id = crypto.randomUUID()
          const bounds = { x: text.x, y: text.y, width: text.width, height: text.height }
          const textShape: TextShape = { ...text, id, bounds, timestamp: Date.now() }

          get().execute((draft) => {
            draft.texts[id] = textShape
            const layer = draft.layers.find((candidate) => candidate.id === text.layerId)
            if (!layer) return
            ;(layer.textIds ??= []).push(id)
            layer.bounds = layer.bounds ? mergeBounds(layer.bounds, bounds) : bounds
          })
          get().spatialIndex.insert(id, text.layerId, bounds)
          get().setSelectedStrokes([id])
        },

        updateText: (id, next) => {
          const text = get().doc.texts[id]
          if (!text) return
          if (text.text === next.text && text.width === next.width && text.height === next.height) return
          const bounds = { ...text.bounds, width: next.width, height: next.height }
          get().execute((draft) => {
            const draftText = draft.texts[id]
            if (!draftText) return
            draftText.text = next.text
            draftText.width = next.width
            draftText.height = next.height
            draftText.bounds = bounds
            recalculateLayerBounds(draft, draftText.layerId)
          })
          get().spatialIndex.remove(id)
          get().spatialIndex.insert(id, text.layerId, bounds)
        },

        setShapeColor: (ids, color) => {
          const targetIds = ids.filter((id) => {
            const stroke = get().doc.strokes[id]
            const text = get().doc.texts[id]
            return (stroke?.color ?? text?.color) !== color
          })
          if (targetIds.length === 0) return
          get().execute((draft) => {
            for (const id of targetIds) {
              if (draft.strokes[id]) draft.strokes[id].color = color
              if (draft.texts[id]) draft.texts[id].color = color
            }
          })
        },

        translateStrokes: (ids, dx, dy) => {
          if (ids.length === 0 || (dx === 0 && dy === 0)) return

          const movedStrokes = ids
            .map((id) => get().doc.strokes[id])
            .filter((stroke): stroke is Stroke => !!stroke && !!stroke.bounds)
          const movedTexts = ids
            .map((id) => get().doc.texts[id])
            .filter((text): text is TextShape => !!text)
          if (movedStrokes.length === 0 && movedTexts.length === 0) return

          const affectedLayerIds = new Set([
            ...movedStrokes.map((stroke) => stroke.layerId),
            ...movedTexts.map((text) => text.layerId),
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
        },

        queryVisibleStrokesByLayer: (viewport) => {
          return get().spatialIndex.query(viewport)
        },

        deleteStrokes: (ids) => {
          if (ids.length === 0) return

          get().spatialIndex.removeBatch(ids)

          get().execute((draft) => {
            ids.forEach((id) => {
              delete draft.strokes[id]
              delete draft.texts[id]
            })

            draft.layers.forEach((layer) => {
              layer.strokeIds = layer.strokeIds.filter((sid) => !ids.includes(sid))
              layer.textIds = (layer.textIds ?? []).filter((textId) => !ids.includes(textId))

              recalculateLayerBounds(draft, layer.id)
            })
          })

          get().setSelectedStrokes(
            get().ui.selectedStrokeIds.filter((selectedId) => !ids.includes(selectedId)),
          )
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
            get().spatialIndex.removeBatch([...layer.strokeIds, ...(layer.textIds ?? [])])
          }

          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer) {
              layer.strokeIds.forEach((sid) => {
                delete draft.strokes[sid]
              })
              ;(layer.textIds ?? []).forEach((textId) => {
                delete draft.texts[textId]
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
          const newTextIds: string[] = []
          const newTextsMap: Record<string, TextShape> = {}

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

          ;(sourceLayer.textIds ?? []).forEach((textId) => {
            const sourceText = get().doc.texts[textId]
            if (!sourceText) return
            const newTextId = crypto.randomUUID()
            newTextsMap[newTextId] = { ...sourceText, id: newTextId, layerId: newLayerId }
            newTextIds.push(newTextId)
          })

          get().execute((draft) => {
            const index = draft.layers.findIndex((l) => l.id === id)
            if (index === -1) return

            Object.entries(newStrokesMap).forEach(([id, stroke]) => {
              draft.strokes[id] = stroke
            })
            Object.entries(newTextsMap).forEach(([id, text]) => {
              draft.texts[id] = text
            })

            const newLayer: Layer = {
              ...sourceLayer,
              id: newLayerId,
              name: `${sourceLayer.name} (Copy)`,
              strokeIds: newStrokeIds,
              textIds: newTextIds,
              bounds: sourceLayer.bounds,
            }

            draft.layers.splice(index + 1, 0, newLayer)
          })

          Object.entries(newStrokesMap).forEach(([id, stroke]) => {
            if (stroke.bounds) {
              get().spatialIndex.insert(id, stroke.layerId, stroke.bounds)
            }
          })
          Object.entries(newTextsMap).forEach(([id, text]) => {
            get().spatialIndex.insert(id, text.layerId, text.bounds)
          })
        },

        toggleLayersPanel: (visible: boolean) => {
          set((state) => ({ ui: { ...state.ui, showLayersPanel: visible } }))
        },

        togglePrecisionPanel: (visible: boolean) => {
          set((state) => ({ ui: { ...state.ui, showPrecisionPanel: visible } }))
        },

        setSidebarOpen: (open: boolean) => {
          set((state) => ({ ui: { ...state.ui, sidebarOpen: open } }))
        },

        setEditingOption: (option: number | null) => {
          set((state) => ({ ui: { ...state.ui, editingOption: option } }))
        },

        setActiveSmooth: (smooth: number) => {
          set((state) => ({ ui: { ...state.ui, activeSmooth: Math.max(0, Math.min(1, smooth)) } }))
        },

        setActiveBrush: (brushId: string) => {
          set((state) => ({ ui: { ...state.ui, activeBrush: brushId } }))
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
            state.doc.layers.forEach((layer) => {
              layer.textIds ??= []
            })
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
