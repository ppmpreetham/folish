import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import { produceWithPatches, applyPatches, enablePatches, Patch } from "immer"
import type { Stroke, Layer, Camera, Tool, Point, CanvasState, UIState } from "../types"
import { calculateStrokeBounds, expandBounds, mergeBounds } from "../utils/bounds"

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

  getActiveLayer: () => Layer | undefined
  getStrokesByLayer: (layerId: string) => Stroke[]

  setCamera: (camera: Camera) => void
  setActiveTool: (tool: Tool) => void
  setActiveColor: (color: string) => void
  setActiveWidth: (width: number) => void
  setActiveLayer: (id: string) => void
  setLayerOpacityTransient: (id: string, opacity: number) => void

  execute: (recipe: (draft: CanvasState) => void) => void
  addStroke: (stroke: Stroke) => void
  updateStrokePoints: (id: string, points: Point[]) => void
  deleteStrokes: (ids: string[]) => void

  addLayer: (name: string) => void
  deleteLayer: (id: string) => void
  toggleLayerVisibility: (id: string) => void
  setLayerOpacity: (id: string, opacity: number) => void
  renameLayer: (id: string, name: string) => void
  toggleLayerLock: (id: string) => void
  duplicateLayer: (id: string) => void

  toggleLayersPanel: (visible: boolean) => void
  togglePrecisionPanel: (visible: boolean) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  resetCanvas: () => void
  clearHistory: () => void
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
      bounds: undefined,
    },
  ],
  strokes: {},
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
}

const MAX_HISTORY = 50

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    persist(
      (set, get) => ({
        doc: initialDoc,
        ui: initialUI,
        past: [],
        future: [],

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

        setCamera: (camera) => set((state) => ({ ui: { ...state.ui, camera } })),
        setActiveTool: (tool) => set((state) => ({ ui: { ...state.ui, activeTool: tool } })),
        setActiveColor: (color) => set((state) => ({ ui: { ...state.ui, activeColor: color } })),
        setActiveOpacity: (opacity: number) =>
          set((state) => ({ ui: { ...state.ui, activeOpacity: opacity } })),
        setActiveWidth: (width) => set((state) => ({ ui: { ...state.ui, activeWidth: width } })),
        setActiveLayer: (id) => set((state) => ({ ui: { ...state.ui, activeLayerId: id } })),

        setLayerOpacityTransient: (id: string, opacity: number) =>
          set((state) => {
            const newLayers = state.doc.layers.map((l) =>
              l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
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

        addStroke: (stroke) =>
          get().execute((draft) => {
            const rawBounds = calculateStrokeBounds(stroke.points)
            const strokeBounds = expandBounds(rawBounds, stroke.width * 2)

            draft.strokes[stroke.id] = { ...stroke, bounds: strokeBounds }
            const layer = draft.layers.find((l) => l.id === stroke.layerId)
            if (layer) {
              layer.strokeIds.push(stroke.id)
              if (!layer.bounds) {
                layer.bounds = strokeBounds
              } else {
                layer.bounds = mergeBounds(layer.bounds, strokeBounds)
              }
            }
          }),

        updateStrokePoints: (id, points) =>
          get().execute((draft) => {
            const stroke = draft.strokes[id]
            if (stroke) stroke.points = [...points]
          }),

        deleteStrokes: (ids) => {
          if (ids.length === 0) return
          get().execute((draft) => {
            ids.forEach((id) => {
              delete draft.strokes[id]
            })

            draft.layers.forEach((layer) => {
              layer.strokeIds = layer.strokeIds.filter((sid) => !ids.includes(sid))

              if (layer.strokeIds.length === 0) {
                layer.bounds = undefined
              } else {
                const strokes = layer.strokeIds
                  .map((id) => draft.strokes[id])
                  .filter((s) => s?.bounds)

                if (strokes.length > 0) {
                  layer.bounds = strokes.reduce(
                    (acc, stroke) => mergeBounds(acc, stroke.bounds!),
                    strokes[0].bounds!
                  )
                }
              }
            })
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
              bounds: undefined,
            })
          })
          get().setActiveLayer(id)
        },

        deleteLayer: (id) => {
          if (get().doc.layers.length <= 1) return
          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer)
              layer.strokeIds.forEach((sid) => {
                delete draft.strokes[sid]
              })
            draft.layers = draft.layers.filter((l) => l.id !== id)
          })
          if (get().ui.activeLayerId === id) get().setActiveLayer(get().doc.layers[0].id)
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

        toggleLayerLock: (id) =>
          get().execute((draft) => {
            const layer = draft.layers.find((l) => l.id === id)
            if (layer) layer.locked = !layer.locked
          }),

        duplicateLayer: (id) =>
          get().execute((draft) => {
            const index = draft.layers.findIndex((l) => l.id === id)
            if (index === -1) return

            const sourceLayer = draft.layers[index]
            const newLayerId = crypto.randomUUID()
            const newStrokeIds: string[] = []

            sourceLayer.strokeIds.forEach((strokeId) => {
              const sourceStroke = draft.strokes[strokeId]
              if (sourceStroke) {
                const newStrokeId = crypto.randomUUID()

                draft.strokes[newStrokeId] = {
                  ...sourceStroke,
                  id: newStrokeId,
                  layerId: newLayerId,
                }
                newStrokeIds.push(newStrokeId)
              }
            })

            const newLayer: Layer = {
              ...sourceLayer,
              id: newLayerId,
              name: `${sourceLayer.name} (Copy)`,
              strokeIds: newStrokeIds,
              bounds: sourceLayer.bounds,
            }

            draft.layers.splice(index + 1, 0, newLayer)
          }),

        toggleLayersPanel: (visible: boolean) => {
          set((state) => ({ ui: { ...state.ui, showLayersPanel: visible } }))
        },

        togglePrecisionPanel: (visible: boolean) => {
          set((state) => ({ ui: { ...state.ui, showPrecisionPanel: visible } }))
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
        },

        canUndo: () => get().past.length > 0,
        canRedo: () => get().future.length > 0,
        resetCanvas: () => set({ doc: initialDoc, ui: initialUI, past: [], future: [] }),
        clearHistory: () => set({ past: [], future: [] }),
      }),
      {
        name: "folish-storage",
        partialize: (state) => ({ doc: state.doc }),
        version: 1,
      }
    )
  )
)
