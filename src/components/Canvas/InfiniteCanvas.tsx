import React, { useRef, useEffect, useCallback, useState } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import { useCanvasEvents } from "../../hooks/useCanvasEvents";
import { useCanvasMath } from "../../hooks/useCanvasMath";
import { Grid } from "./Grid";
import { Renderer } from "./Renderer";
import { SelectionOverlay } from "./SelectionOverlay";
import { ShapePreview } from "./ShapePreview";
import StyleBar from "../UI/StyleBar";
import ContextMenu from "../UI/ContextMenu";
import { SpatialIndexStats } from "../Debug/SpatialIndexStats";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "../../utils/brushEngine";
import { boundsIntersect } from "../../utils/bounds";
import { transformSelectionPoint } from "../../utils/selectionTransform";
import {
  CanvasBackgroundType,
  type Bounds,
  type Point,
  type ShapeKind,
  type FontFamilyId,
  type Stroke,
} from "../../types";
import { getBrushProperties, hasToolFunction } from "../../utils/toolsData";
import {
  DEFAULT_LINE_LENGTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_SHAPE_WIDTH,
  SHAPE_STROKE_WIDTHS,
  getShapeBounds,
  pointHitsShape,
  snapPoint,
} from "../../utils/shapes";
import { getFontStack, getLineHeight } from "../../utils/textStyle";
import { computeBucketFill } from "../../utils/bucketFill";
import blueprintBg from "../../assets/backgrounds/blueprint.png";
import brownPaperBg from "../../assets/backgrounds/brown paper.png";
import crumpledPaperBg from "../../assets/backgrounds/crumpled.png";

const BACKGROUND_TEXTURES: Partial<
  Record<
    CanvasBackgroundType,
    { src: string; width: number; height: number; fallbackColor: string }
  >
> = {
  [CanvasBackgroundType.Blueprint]: {
    src: blueprintBg,
    width: 1443,
    height: 1385,
    fallbackColor: "#1e81cd",
  },
  [CanvasBackgroundType.Brown]: {
    src: brownPaperBg,
    width: 800,
    height: 600,
    fallbackColor: "#996f4c",
  },
  [CanvasBackgroundType.Crumpled]: {
    src: crumpledPaperBg,
    width: 1730,
    height: 1155,
    fallbackColor: "#f5f0eb",
  },
};

const V_MAX = 12;
const ALPHA_MIN = 0.15;
const ALPHA_MAX = 0.85;
const SELECTION_DRAG_THRESHOLD_PX = 3;

type SelectionInteraction = {
  origin: CanvasPoint;
  initialSelectedIds: string[];
  mode: "pending" | "brushing" | "marquee" | "translating" | "scaling" | "rotating";
  hasHitStroke: boolean;
  lassoPoints: CanvasPoint[];
  bounds?: Bounds;
  transformOrigin?: CanvasPoint;
  startAngle?: number;
};

type CanvasPoint = Pick<Point, "x" | "y">;

type TextDraft = {
  id: string;
  sourceTextId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  layerId: string;
  color: string;
  opacity: number;
  rotation?: number;
  fontSize: number;
  fontFamily: FontFamilyId;
  textAlign: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
};

type ShapeDraft = {
  kind: ShapeKind;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  flipX: boolean;
  flipY: boolean;
};

type FillInteraction = {
  points: CanvasPoint[];
  layerId: string;
  color: string;
  opacity: number;
};

type NudgeInteraction = {
  strokeId: string;
  origin: CanvasPoint;
  originalPoints: Point[];
  influences: number[];
};

const TEXT_MIN_WIDTH_PX = 120;
const TEXT_MIN_HEIGHT_PX = 24;
const NUDGE_RADIUS_PX = 72;
const TRANSFORM_HANDLE_RADIUS_PX = 12;
const MIN_SELECTION_SCALE = 0.05;
const ROTATION_HANDLE_OFFSET_PX = 28;
const SHAPE_MIN_SIZE = 4;
const ROTATE_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23374151%22 stroke-width=%222%22 stroke-linecap=%22round%22%3E%3Cpath d=%22M20 11a8 8 0 1 1-2.3-5.7%22/%3E%3Cpath d=%22M20 4v7h-7%22/%3E%3C/svg%3E") 12 12, auto';

const selectionEquals = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

const mergeSelectionBounds = (state: ReturnType<typeof useCanvasStore.getState>, ids: string[]) => {
  let bounds: Bounds | undefined;
  for (const id of ids) {
    const next =
      state.doc.strokes[id]?.bounds ??
      state.doc.texts[id]?.bounds ??
      state.doc.images?.[id]?.bounds;
    if (!next) continue;
    if (!bounds) {
      bounds = { ...next };
      continue;
    }
    const right = Math.max(bounds.x + bounds.width, next.x + next.width);
    const bottom = Math.max(bounds.y + bounds.height, next.y + next.height);
    bounds.x = Math.min(bounds.x, next.x);
    bounds.y = Math.min(bounds.y, next.y);
    bounds.width = right - bounds.x;
    bounds.height = bottom - bounds.y;
  }
  return bounds;
};

const getLassoBounds = (points: CanvasPoint[]): Bounds => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const isPointInPolygon = (point: CanvasPoint, polygon: CanvasPoint[]) => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      isInside = !isInside;
    }
  }
  return isInside;
};

const isPointInBounds = (point: CanvasPoint, bounds: Bounds) =>
  point.x >= bounds.x &&
  point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y <= bounds.y + bounds.height;

const segmentsIntersect = (a: CanvasPoint, b: CanvasPoint, c: CanvasPoint, d: CanvasPoint) => {
  const cross = (origin: CanvasPoint, first: CanvasPoint, second: CanvasPoint) =>
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x);
  const isOnSegment = (start: CanvasPoint, point: CanvasPoint, end: CanvasPoint) =>
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (abC === 0 && isOnSegment(a, c, b)) return true;
  if (abD === 0 && isOnSegment(a, d, b)) return true;
  if (cdA === 0 && isOnSegment(c, a, d)) return true;
  if (cdB === 0 && isOnSegment(c, b, d)) return true;
  return abC > 0 !== abD > 0 && cdA > 0 !== cdB > 0;
};

const lassoIntersectsBounds = (lasso: CanvasPoint[], bounds: Bounds) => {
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
  if (lasso.some((point) => isPointInBounds(point, bounds))) return true;
  if (corners.some((point) => isPointInPolygon(point, lasso))) return true;
  for (let index = 0; index < lasso.length; index++) {
    const a = lasso[index];
    const b = lasso[(index + 1) % lasso.length];
    for (let edge = 0; edge < corners.length; edge++) {
      if (segmentsIntersect(a, b, corners[edge], corners[(edge + 1) % corners.length])) return true;
    }
  }
  return false;
};

const lassoContainsBounds = (lasso: CanvasPoint[], bounds: Bounds) =>
  [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].every((point) => isPointInPolygon(point, lasso));

const getStrokeWorldPoints = (stroke: Stroke): CanvasPoint[] => {
  const offsetX = stroke.offset?.x ?? 0;
  const offsetY = stroke.offset?.y ?? 0;
  return stroke.points.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }));
};

const pathsIntersect = (
  first: CanvasPoint[],
  second: CanvasPoint[],
  closeFirst: boolean,
  closeSecond: boolean,
) => {
  const firstSegments = Math.max(0, first.length - 1 + Number(closeFirst && first.length > 2));
  const secondSegments = Math.max(0, second.length - 1 + Number(closeSecond && second.length > 2));
  for (let firstIndex = 0; firstIndex < firstSegments; firstIndex++) {
    const firstStart = first[firstIndex];
    const firstEnd = first[(firstIndex + 1) % first.length];
    for (let secondIndex = 0; secondIndex < secondSegments; secondIndex++) {
      const secondStart = second[secondIndex];
      const secondEnd = second[(secondIndex + 1) % second.length];
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return true;
    }
  }
  return false;
};

const lassoHitsStroke = (lasso: CanvasPoint[], stroke: Stroke, zoom: number, wrapping: boolean) => {
  const points = getStrokeWorldPoints(stroke);
  if (points.length === 0) return false;

  if (wrapping) return points.every((point) => isPointInPolygon(point, lasso));

  if (stroke.tool === "fill") {
    return (
      points.some((point) => isPointInPolygon(point, lasso)) ||
      lasso.some((point) => isPointInPolygon(point, points)) ||
      pathsIntersect(lasso, points, true, true)
    );
  }

  if (points.some((point) => isPointInPolygon(point, lasso))) return true;
  if (pathsIntersect(lasso, points, true, false)) return true;
  return lasso.some((point) => pointsHitStroke(points, stroke.width, point, zoom));
};

const getClosedPathData = (points: CanvasPoint[]) =>
  points.length < 3 ? "" : `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`;

const pointsHitStroke = (
  points: CanvasPoint[],
  width: number,
  point: CanvasPoint,
  zoom: number,
) => {
  const tolerance = Math.max(width * 1.5, 8 / zoom);
  const toleranceSquared = tolerance * tolerance;

  if (!points.length) return true;
  if (points.length === 1) {
    const dx = point.x - points[0].x;
    const dy = point.y - points[0].y;
    return dx * dx + dy * dy <= toleranceSquared;
  }

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    const ax = start.x;
    const ay = start.y;
    const bx = end.x;
    const by = end.y;
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSquared = abx * abx + aby * aby;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - ax) * abx + (point.y - ay) * aby) / lengthSquared));
    const dx = point.x - (ax + abx * t);
    const dy = point.y - (ay + aby * t);
    if (dx * dx + dy * dy <= toleranceSquared) return true;
  }

  return false;
};

const pointHitsStroke = (stroke: Stroke, point: CanvasPoint, zoom: number) => {
  const points = getStrokeWorldPoints(stroke);
  if (stroke.tool === "fill") return isPointInPolygon(point, points);
  return pointsHitStroke(points, stroke.width, point, zoom);
};

export const InfiniteCanvas: React.FC = () => {
  const ui = useCanvasStore((state) => state.ui);
  const addStroke = useCanvasStore((s) => s.addStroke);
  const addText = useCanvasStore((s) => s.addText);
  const updateText = useCanvasStore((s) => s.updateText);
  const updateStrokeGeometry = useCanvasStore((s) => s.updateStrokeGeometry);
  const commitShapeTransform = useCanvasStore((s) => s.commitShapeTransform);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const currentInputTypeRef = useRef<string>("mouse");

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const currentPointsRef = useRef<Array<{ x: number; y: number; pressure: number }>>([]);
  const cameraRef = useRef(ui.camera);
  const lastStablePointRef = useRef<{ x: number; y: number } | null>(null);
  const selectionRef = useRef<SelectionInteraction | null>(null);
  const nudgeRef = useRef<NudgeInteraction | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const textDraftRef = useRef<TextDraft | null>(null);
  const fillRef = useRef<FillInteraction | null>(null);

  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const setTextDraftState = useCallback((draft: TextDraft | null) => {
    textDraftRef.current = draft;
    setTextDraft(draft);
  }, []);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft | null>(null);
  const shapeDraftRef = useRef<ShapeDraft | null>(null);
  const setShapeDraftState = useCallback((draft: ShapeDraft | null) => {
    shapeDraftRef.current = draft;
    setShapeDraft(draft);
  }, []);
  const [fillPreview, setFillPreview] = useState<CanvasPoint[] | null>(null);
  const [hoveredTransformHandle, setHoveredTransformHandle] = useState<
    "move" | "scale" | "rotate" | null
  >(null);
  const { toWorld } = useCanvasMath({ cameraRef, rectRef });

  useEffect(() => {
    cameraRef.current = ui.camera;
  }, [ui.camera]);

  useEffect(() => {
    if (!textDraft?.id) return;
    const el = textAreaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [textDraft?.id]);

  useEffect(() => {
    if (!textDraft) return;
    if (textDraft.color !== ui.activeColor) {
      setTextDraftState({ ...textDraft, color: ui.activeColor });
    }
  }, [ui.activeColor, textDraft, setTextDraftState]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (!dataUrl) return;
            const img = new Image();
            img.onload = () => {
              const state = useCanvasStore.getState();
              const cam = state.ui.camera;
              const width = Math.min(img.naturalWidth || 400, 800);
              const height = (img.naturalHeight / (img.naturalWidth || 1)) * width || 300;
              const centerX = -cam.x / cam.zoom;
              const centerY = -cam.y / cam.zoom;
              const id = crypto.randomUUID();
              state.addImage({
                layerId: state.ui.activeLayerId,
                x: centerX - width / 2,
                y: centerY - height / 2,
                width,
                height,
                src: dataUrl,
                opacity: 1,
              });
              state.setSelectedStrokes([id]);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
          return;
        }
      }

      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim()) {
        e.preventDefault();
        const state = useCanvasStore.getState();
        const cam = state.ui.camera;
        const id = crypto.randomUUID();
        const centerX = -cam.x / cam.zoom;
        const centerY = -cam.y / cam.zoom;
        state.addText({
          layerId: state.ui.activeLayerId,
          x: centerX - 100,
          y: centerY - 20,
          width: Math.max(120, text.length * 9),
          height: 36,
          text: text.trim(),
          color: state.ui.activeColor,
          opacity: state.ui.activeOpacity,
        });
        state.setSelectedStrokes([id]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const getTransformCursor = useCallback((point: CanvasPoint) => {
    const state = useCanvasStore.getState();
    if (
      !hasToolFunction(state.ui.activeTool, "select") &&
      !hasToolFunction(state.ui.activeTool, "marquee")
    ) {
      return null;
    }
    const bounds = mergeSelectionBounds(state, state.ui.selectedStrokeIds);
    if (!bounds) return null;
    const handleRadius = TRANSFORM_HANDLE_RADIUS_PX / cameraRef.current.zoom;
    const centerX = bounds.x + bounds.width / 2;
    const rotationHandle = {
      x: centerX,
      y: bounds.y - ROTATION_HANDLE_OFFSET_PX / cameraRef.current.zoom,
    };
    if (Math.hypot(point.x - rotationHandle.x, point.y - rotationHandle.y) <= handleRadius)
      return "rotate";
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ];
    if (
      corners.some((corner) => Math.hypot(point.x - corner.x, point.y - corner.y) <= handleRadius)
    )
      return "scale";
    return isPointInBounds(point, bounds) ? "move" : null;
  }, []);

  useEffect(() => {
    if (!containerRef.current || !overlayCanvasRef.current) return;
    const canvas = overlayCanvasRef.current;
    const parent = containerRef.current;

    const updateLayout = () => {
      const rect = parent.getBoundingClientRect();
      rectRef.current = rect;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false;
      }

      setCamera(cameraRef.current);
    };

    const observer = new ResizeObserver(updateLayout);
    observer.observe(parent);
    updateLayout();

    window.addEventListener("scroll", updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateLayout);
      const raf = rafRef.current;
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [setCamera]);

  const renderLiveStroke = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || currentPointsRef.current.length < 2) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const points = currentPointsRef.current;
    const isPen = currentInputTypeRef.current === "pen";

    const outlinePoints = getStroke(points, {
      ...getBrushProperties(ui.activeBrush),
      smoothing: ui.activeSmooth,
      size: ui.activeWidth,
      simulatePressure: !isPen,
    });

    ctx.save();
    const cam = cameraRef.current;
    const rect = rectRef.current;
    const centerX = rect?.width ? rect.width / 2 : canvas.clientWidth / 2;
    const centerY = rect?.height ? rect.height / 2 : canvas.clientHeight / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((cam.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    ctx.beginPath();
    if (outlinePoints.length > 0) {
      ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
      for (let i = 1; i < outlinePoints.length; i++) {
        ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
      }
    }
    ctx.closePath();
    ctx.fillStyle = ui.activeColor;
    ctx.fill();
    ctx.restore();
  }, [ui.activeBrush, ui.activeWidth, ui.activeSmooth, ui.activeColor]);

  const findTopmostStrokeAtPoint = useCallback((point: CanvasPoint) => {
    const state = useCanvasStore.getState();
    const tolerance = 10 / cameraRef.current.zoom;
    const candidates = state.spatialIndex.query({
      x: point.x - tolerance,
      y: point.y - tolerance,
      width: tolerance * 2,
      height: tolerance * 2,
    });

    for (let layerIndex = state.doc.layers.length - 1; layerIndex >= 0; layerIndex--) {
      const layer = state.doc.layers[layerIndex];
      if (!layer.visible || layer.locked) continue;
      const candidateIds = candidates[layer.id];
      if (!candidateIds?.length) continue;
      const candidateIdSet = new Set(candidateIds);

      for (let textIndex = (layer.textIds?.length ?? 0) - 1; textIndex >= 0; textIndex--) {
        const textId = layer.textIds![textIndex];
        const text = state.doc.texts[textId];
        if (text && candidateIdSet.has(text.id)) {
          const textBounds = {
            x: text.x + (text.offset?.x ?? 0),
            y: text.y + (text.offset?.y ?? 0),
            width: text.width,
            height: text.height,
          };
          if (
            point.x >= textBounds.x - tolerance &&
            point.x <= textBounds.x + textBounds.width + tolerance &&
            point.y >= textBounds.y - tolerance &&
            point.y <= textBounds.y + textBounds.height + tolerance
          ) {
            return text.id;
          }
        }
      }

      for (let imgIndex = (layer.imageIds?.length ?? 0) - 1; imgIndex >= 0; imgIndex--) {
        const imgId = layer.imageIds![imgIndex];
        const img = state.doc.images?.[imgId];
        if (img && candidateIdSet.has(img.id)) {
          const imgBounds = {
            x: img.x + (img.offset?.x ?? 0),
            y: img.y + (img.offset?.y ?? 0),
            width: img.width,
            height: img.height,
          };
          if (
            point.x >= imgBounds.x &&
            point.x <= imgBounds.x + imgBounds.width &&
            point.y >= imgBounds.y &&
            point.y <= imgBounds.y + imgBounds.height
          ) {
            return img.id;
          }
        }
      }

      for (let shapeIndex = (layer.shapeIds?.length ?? 0) - 1; shapeIndex >= 0; shapeIndex--) {
        const shapeId = layer.shapeIds![shapeIndex];
        const shape = state.doc.shapes?.[shapeId];
        if (
          shape &&
          candidateIdSet.has(shape.id) &&
          pointHitsShape(
            {
              kind: shape.kind,
              x: shape.x + (shape.offset?.x ?? 0),
              y: shape.y + (shape.offset?.y ?? 0),
              width: shape.width,
              height: shape.height,
              fill: shape.fill,
              size: shape.size,
              flipX: shape.flipX,
              flipY: shape.flipY,
            },
            point,
            cameraRef.current.zoom,
          )
        ) {
          return shape.id;
        }
      }

      for (let strokeIndex = layer.strokeIds.length - 1; strokeIndex >= 0; strokeIndex--) {
        const stroke = state.doc.strokes[layer.strokeIds[strokeIndex]];
        if (
          stroke &&
          candidateIdSet.has(stroke.id) &&
          pointHitsStroke(stroke, point, cameraRef.current.zoom)
        ) {
          return stroke.id;
        }
      }
    }

    return undefined;
  }, []);

  const updateLassoSelection = useCallback(
    (
      lassoPoints: CanvasPoint[],
      initialSelectedIds: string[],
      additive: boolean,
      wrapping: boolean,
    ) => {
      const state = useCanvasStore.getState();
      if (lassoPoints.length < 3) return;
      const candidates = state.spatialIndex.query(getLassoBounds(lassoPoints));
      const nextIds = new Set(additive ? initialSelectedIds : []);

      for (const layer of state.doc.layers) {
        if (!layer.visible || layer.locked) continue;
        const candidateIds = candidates[layer.id];
        if (!candidateIds) continue;
        for (const id of candidateIds) {
          const stroke = state.doc.strokes[id];
          const text = state.doc.texts[id];
          const img = state.doc.images?.[id];
          const bounds = stroke?.bounds ?? text?.bounds ?? img?.bounds;
          if (!bounds) continue;
          const isSelected = stroke
            ? lassoHitsStroke(lassoPoints, stroke, cameraRef.current.zoom, wrapping)
            : wrapping
              ? lassoContainsBounds(lassoPoints, bounds)
              : lassoIntersectsBounds(lassoPoints, bounds);
          if (isSelected) {
            nextIds.add(id);
          }
        }
      }

      const selectedIds = Array.from(nextIds);
      if (!selectionEquals(state.ui.selectedStrokeIds, selectedIds)) {
        state.setSelectedStrokes(selectedIds);
      }
    },
    [],
  );

  const updateMarqueeSelection = useCallback(
    (marquee: Bounds, initialSelectedIds: string[], additive: boolean, wrapping: boolean) => {
      const state = useCanvasStore.getState();
      const candidates = state.spatialIndex.query(marquee);
      const nextIds = new Set(additive ? initialSelectedIds : []);
      for (const layer of state.doc.layers) {
        if (!layer.visible || layer.locked) continue;
        for (const id of candidates[layer.id] ?? []) {
          const bounds =
            state.doc.strokes[id]?.bounds ??
            state.doc.texts[id]?.bounds ??
            state.doc.images?.[id]?.bounds;
          if (!bounds) continue;
          const isSelected = wrapping
            ? marquee.x <= bounds.x &&
              marquee.y <= bounds.y &&
              marquee.x + marquee.width >= bounds.x + bounds.width &&
              marquee.y + marquee.height >= bounds.y + bounds.height
            : boundsIntersect(marquee, bounds);
          if (isSelected) nextIds.add(id);
        }
      }
      const selectedIds = Array.from(nextIds);
      if (!selectionEquals(state.ui.selectedStrokeIds, selectedIds))
        state.setSelectedStrokes(selectedIds);
    },
    [],
  );

  const handleSelectionStart = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const state = useCanvasStore.getState();
      const isMarqueeTool = hasToolFunction(state.ui.activeTool, "marquee");
      const supportsSelectionTransform =
        isMarqueeTool || hasToolFunction(state.ui.activeTool, "select");
      if (supportsSelectionTransform) {
        const initialSelectedIds = state.ui.selectedStrokeIds;
        const selectedBounds = mergeSelectionBounds(state, initialSelectedIds);
        const handleRadius = TRANSFORM_HANDLE_RADIUS_PX / cameraRef.current.zoom;
        const resetTransform = () => {
          state.setSelectionTranslation({ x: 0, y: 0 });
          state.setSelectionScale({ x: 1, y: 1 });
          state.setSelectionRotation(0);
          state.setSelectionTransformOrigin(null);
        };
        if (selectedBounds) {
          const center = {
            x: selectedBounds.x + selectedBounds.width / 2,
            y: selectedBounds.y + selectedBounds.height / 2,
          };
          const rotateHandle = {
            x: center.x,
            y: selectedBounds.y - ROTATION_HANDLE_OFFSET_PX / cameraRef.current.zoom,
          };
          if (Math.hypot(point.x - rotateHandle.x, point.y - rotateHandle.y) <= handleRadius) {
            resetTransform();
            state.setSelectionTransformOrigin(center);
            selectionRef.current = {
              origin: point,
              initialSelectedIds,
              mode: "rotating",
              hasHitStroke: true,
              lassoPoints: [point],
              bounds: selectedBounds,
              transformOrigin: center,
              startAngle: Math.atan2(point.y - center.y, point.x - center.x),
            };
            return;
          }

          const corners = [
            {
              x: selectedBounds.x,
              y: selectedBounds.y,
              opposite: {
                x: selectedBounds.x + selectedBounds.width,
                y: selectedBounds.y + selectedBounds.height,
              },
            },
            {
              x: selectedBounds.x + selectedBounds.width,
              y: selectedBounds.y,
              opposite: { x: selectedBounds.x, y: selectedBounds.y + selectedBounds.height },
            },
            {
              x: selectedBounds.x + selectedBounds.width,
              y: selectedBounds.y + selectedBounds.height,
              opposite: { x: selectedBounds.x, y: selectedBounds.y },
            },
            {
              x: selectedBounds.x,
              y: selectedBounds.y + selectedBounds.height,
              opposite: { x: selectedBounds.x + selectedBounds.width, y: selectedBounds.y },
            },
          ];
          const corner = corners.find(
            (candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y) <= handleRadius,
          );
          if (corner) {
            resetTransform();
            state.setSelectionTransformOrigin(corner.opposite);
            selectionRef.current = {
              origin: point,
              initialSelectedIds,
              mode: "scaling",
              hasHitStroke: true,
              lassoPoints: [point],
              bounds: selectedBounds,
              transformOrigin: corner.opposite,
            };
            return;
          }
          if (isPointInBounds(point, selectedBounds)) {
            resetTransform();
            state.setSelectionTransformOrigin(center);
            selectionRef.current = {
              origin: point,
              initialSelectedIds,
              mode: "translating",
              hasHitStroke: true,
              lassoPoints: [point],
              bounds: selectedBounds,
              transformOrigin: center,
            };
            return;
          }
        }
        if (isMarqueeTool) {
          if (!modifiers.shiftKey && initialSelectedIds.length) state.setSelectedStrokes([]);
          selectionRef.current = {
            origin: point,
            initialSelectedIds,
            mode: "pending",
            hasHitStroke: false,
            lassoPoints: [point],
          };
          return;
        }
      }
      const hitStrokeId = findTopmostStrokeAtPoint(point);
      const initialSelectedIds = state.ui.selectedStrokeIds;

      if (hitStrokeId) {
        const selectedIds = modifiers.shiftKey
          ? initialSelectedIds.includes(hitStrokeId)
            ? initialSelectedIds.filter((id) => id !== hitStrokeId)
            : [...initialSelectedIds, hitStrokeId]
          : initialSelectedIds.includes(hitStrokeId)
            ? initialSelectedIds
            : [hitStrokeId];
        state.setSelectedStrokes(selectedIds);
        selectionRef.current = {
          origin: point,
          initialSelectedIds: selectedIds,
          mode: "pending",
          hasHitStroke: true,
          lassoPoints: [point],
        };
      } else {
        if (!modifiers.shiftKey && initialSelectedIds.length) state.setSelectedStrokes([]);
        selectionRef.current = {
          origin: point,
          initialSelectedIds,
          mode: "pending",
          hasHitStroke: false,
          lassoPoints: [point],
        };
      }
    },
    [findTopmostStrokeAtPoint],
  );

  const handleSelectionMove = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const interaction = selectionRef.current;
      if (!interaction) return;

      const dx = point.x - interaction.origin.x;
      const dy = point.y - interaction.origin.y;
      if (
        interaction.mode === "pending" &&
        Math.hypot(dx, dy) * cameraRef.current.zoom < SELECTION_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      const state = useCanvasStore.getState();
      if (interaction.mode === "translating") {
        state.setSelectionTranslation({ x: dx, y: dy });
        return;
      }
      if (interaction.mode === "scaling") {
        const origin = interaction.transformOrigin!;
        const startX = interaction.origin.x - origin.x;
        const startY = interaction.origin.y - origin.y;
        const nextX = point.x - origin.x;
        const nextY = point.y - origin.y;
        const startDistance = Math.hypot(startX, startY);
        const nextDistance = Math.hypot(nextX, nextY);
        const scale = Math.max(
          MIN_SELECTION_SCALE,
          startDistance < 0.001 ? 1 : nextDistance / startDistance,
        );
        state.setSelectionScale({
          x: scale,
          y: scale,
        });
        return;
      }
      if (interaction.mode === "rotating") {
        const origin = interaction.transformOrigin!;
        const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
        state.setSelectionRotation(((angle - interaction.startAngle!) * 180) / Math.PI);
        return;
      }
      if (interaction.mode === "pending") {
        if (hasToolFunction(state.ui.activeTool, "marquee")) {
          interaction.mode = "marquee";
        } else if (!interaction.hasHitStroke) {
          interaction.mode = "brushing";
        } else {
          interaction.mode = "translating";
        }
      }

      if (interaction.mode === "translating") {
        state.setSelectionTranslation({ x: dx, y: dy });
        return;
      }

      if (interaction.mode === "marquee") {
        const marquee = {
          x: Math.min(interaction.origin.x, point.x),
          y: Math.min(interaction.origin.y, point.y),
          width: Math.abs(point.x - interaction.origin.x),
          height: Math.abs(point.y - interaction.origin.y),
        };
        state.setSelectionMarquee(marquee);
        updateMarqueeSelection(
          marquee,
          interaction.initialSelectedIds,
          modifiers.shiftKey,
          modifiers.ctrlKey || modifiers.metaKey,
        );
        return;
      }

      const lastPoint = interaction.lassoPoints[interaction.lassoPoints.length - 1];
      const minDistance = 2 / cameraRef.current.zoom;
      if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= minDistance) {
        interaction.lassoPoints.push(point);
      }
      state.setSelectionLasso({ points: [...interaction.lassoPoints] });
      updateLassoSelection(
        interaction.lassoPoints,
        interaction.initialSelectedIds,
        modifiers.shiftKey,
        modifiers.ctrlKey || modifiers.metaKey,
      );
    },
    [updateLassoSelection, updateMarqueeSelection],
  );

  const handleSelectionEnd = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
      const interaction = selectionRef.current;
      selectionRef.current = null;
      if (!interaction) return;

      const state = useCanvasStore.getState();
      const dx = point.x - interaction.origin.x;
      const dy = point.y - interaction.origin.y;
      if (
        interaction.mode === "translating" ||
        interaction.mode === "scaling" ||
        interaction.mode === "rotating"
      ) {
        const origin = interaction.transformOrigin;
        if (origin) {
          const { selectionTranslation, selectionScale, selectionRotation } = state.ui;
          const selectedIds = state.ui.selectedStrokeIds;
          const strokeUpdates = selectedIds.flatMap((id) => {
            const stroke = state.doc.strokes[id];
            if (!stroke) return [];
            const offsetX = stroke.offset?.x ?? 0;
            const offsetY = stroke.offset?.y ?? 0;
            const points = stroke.points.map((strokePoint) => {
              const world = transformSelectionPoint(
                { x: strokePoint.x + offsetX, y: strokePoint.y + offsetY },
                {
                  origin,
                  scale: selectionScale,
                  rotation: selectionRotation,
                  translation: selectionTranslation,
                },
              );
              return { ...strokePoint, x: world.x - offsetX, y: world.y - offsetY };
            });
            const pathData =
              stroke.tool === "fill"
                ? getClosedPathData(points)
                : getSvgPathFromStroke(
                    getStroke(points, { ...getBrushProperties(stroke.tool), size: stroke.width }),
                  );
            return [{ id, points, pathData }];
          });
          const textUpdates = selectedIds.flatMap((id) => {
            const text = state.doc.texts[id];
            if (!text) return [];
            const offsetX = text.offset?.x ?? 0;
            const offsetY = text.offset?.y ?? 0;
            const position = transformSelectionPoint(
              { x: text.x + offsetX, y: text.y + offsetY },
              {
                origin,
                scale: selectionScale,
                rotation: selectionRotation,
                translation: selectionTranslation,
              },
            );
            return [
              {
                id,
                x: position.x,
                y: position.y,
                width: Math.max(1, text.width * selectionScale.x),
                height: Math.max(1, text.height * selectionScale.y),
                rotation: (text.rotation ?? 0) + selectionRotation,
              },
            ];
          });
          const imageUpdates = selectedIds.flatMap((id) => {
            const img = state.doc.images?.[id];
            if (!img) return [];
            const offsetX = img.offset?.x ?? 0;
            const offsetY = img.offset?.y ?? 0;
            const position = transformSelectionPoint(
              { x: img.x + offsetX, y: img.y + offsetY },
              {
                origin,
                scale: selectionScale,
                rotation: selectionRotation,
                translation: selectionTranslation,
              },
            );
            return [
              {
                id,
                x: position.x,
                y: position.y,
                width: Math.max(1, img.width * selectionScale.x),
                height: Math.max(1, img.height * selectionScale.y),
                rotation: (img.rotation ?? 0) + selectionRotation,
              },
            ];
          });
          const shapeUpdates = selectedIds.flatMap((id) => {
            const shape = state.doc.shapes?.[id];
            if (!shape) return [];
            const offsetX = shape.offset?.x ?? 0;
            const offsetY = shape.offset?.y ?? 0;
            const position = transformSelectionPoint(
              { x: shape.x + offsetX, y: shape.y + offsetY },
              {
                origin,
                scale: selectionScale,
                rotation: selectionRotation,
                translation: selectionTranslation,
              },
            );
            return [
              {
                id,
                x: position.x,
                y: position.y,
                width: Math.max(1, shape.width * selectionScale.x),
                height: Math.max(1, shape.height * selectionScale.y),
                rotation: (shape.rotation ?? 0) + selectionRotation,
              },
            ];
          });
          commitShapeTransform(strokeUpdates, textUpdates, imageUpdates, shapeUpdates);
        } else if (interaction.mode === "translating") {
          state.translateStrokes(state.ui.selectedStrokeIds, dx, dy);
        }
        state.setSelectionTranslation({ x: 0, y: 0 });
        state.setSelectionScale({ x: 1, y: 1 });
        state.setSelectionRotation(0);
        state.setSelectionTransformOrigin(null);
      } else if (interaction.mode === "marquee") {
        const marquee = {
          x: Math.min(interaction.origin.x, point.x),
          y: Math.min(interaction.origin.y, point.y),
          width: Math.abs(point.x - interaction.origin.x),
          height: Math.abs(point.y - interaction.origin.y),
        };
        updateMarqueeSelection(
          marquee,
          interaction.initialSelectedIds,
          modifiers.shiftKey,
          modifiers.ctrlKey || modifiers.metaKey,
        );
        state.setSelectionMarquee(null);
      } else if (interaction.mode === "brushing") {
        if (interaction.lassoPoints.length < 3) interaction.lassoPoints.push(point);
        updateLassoSelection(
          interaction.lassoPoints,
          interaction.initialSelectedIds,
          modifiers.shiftKey,
          modifiers.ctrlKey || modifiers.metaKey,
        );
        state.setSelectionLasso(null);
      }
    },
    [commitShapeTransform, updateLassoSelection, updateMarqueeSelection],
  );

  const handleNudgeStart = useCallback(
    (point: CanvasPoint) => {
      const state = useCanvasStore.getState();
      const strokeId = findTopmostStrokeAtPoint(point);
      const stroke = strokeId ? state.doc.strokes[strokeId] : undefined;
      if (!stroke || stroke.points.length === 0) return;

      const layer = state.doc.layers.find((candidate) => candidate.id === stroke.layerId);
      if (!layer || layer.locked) return;
      state.setSelectedStrokes([stroke.id]);

      const radius = NUDGE_RADIUS_PX / cameraRef.current.zoom;
      const offsetX = stroke.offset?.x ?? 0;
      const offsetY = stroke.offset?.y ?? 0;
      const influences = stroke.points.map((strokePoint) => {
        const distance = Math.hypot(
          strokePoint.x + offsetX - point.x,
          strokePoint.y + offsetY - point.y,
        );
        const normalized = Math.max(0, 1 - distance / radius);
        return normalized * normalized;
      });
      const strongest = Math.max(...influences);
      if (strongest === 0) return;
      nudgeRef.current = {
        strokeId: stroke.id,
        origin: point,
        originalPoints: stroke.points.map((strokePoint) => ({ ...strokePoint })),
        influences,
      };
    },
    [findTopmostStrokeAtPoint],
  );

  const handleNudgeMove = useCallback((point: CanvasPoint) => {
    const interaction = nudgeRef.current;
    if (!interaction) return;
    const state = useCanvasStore.getState();
    const stroke = state.doc.strokes[interaction.strokeId];
    if (!stroke) return;
    const dx = point.x - interaction.origin.x;
    const dy = point.y - interaction.origin.y;
    const points = interaction.originalPoints.map((strokePoint, index) => ({
      ...strokePoint,
      x: strokePoint.x + dx * interaction.influences[index],
      y: strokePoint.y + dy * interaction.influences[index],
    }));
    const pathData =
      stroke.tool === "fill"
        ? getClosedPathData(points)
        : getSvgPathFromStroke(
            getStroke(points, { ...getBrushProperties(stroke.tool), size: stroke.width }),
          );
    state.setNudgePreview({ strokeId: stroke.id, pathData });
  }, []);

  const handleNudgeEnd = useCallback(
    (point: CanvasPoint) => {
      const interaction = nudgeRef.current;
      nudgeRef.current = null;
      if (!interaction) return;
      const state = useCanvasStore.getState();
      const stroke = state.doc.strokes[interaction.strokeId];
      const dx = point.x - interaction.origin.x;
      const dy = point.y - interaction.origin.y;
      if (!stroke || Math.hypot(dx, dy) < 0.01) {
        state.setNudgePreview(null);
        return;
      }
      const points = interaction.originalPoints.map((strokePoint, index) => ({
        ...strokePoint,
        x: strokePoint.x + dx * interaction.influences[index],
        y: strokePoint.y + dy * interaction.influences[index],
      }));
      const pathData =
        stroke.tool === "fill"
          ? getClosedPathData(points)
          : getSvgPathFromStroke(
              getStroke(points, { ...getBrushProperties(stroke.tool), size: stroke.width }),
            );
      state.setNudgePreview(null);
      updateStrokeGeometry(stroke.id, points, pathData);
    },
    [updateStrokeGeometry],
  );

  const commitText = useCallback(
    (draftId?: string) => {
      const draft = textDraftRef.current;
      if (!draft || (draftId && draft.id !== draftId)) return;
      textDraftRef.current = null;
      setTextDraft(null);

      const text = draft.text.trimEnd();
      if (draft.sourceTextId) {
        if (text) {
          updateText(draft.sourceTextId, { text, width: draft.width, height: draft.height });
        } else {
          useCanvasStore.getState().deleteStrokes([draft.sourceTextId]);
        }
      } else if (text) {
        addText({
          layerId: draft.layerId,
          x: draft.x,
          y: draft.y,
          width: draft.width,
          height: draft.height,
          text,
          color: draft.color,
          opacity: draft.opacity,
          fontSize: draft.fontSize,
          fontFamily: draft.fontFamily,
          textAlign: draft.textAlign,
          bold: draft.bold,
          italic: draft.italic,
        });
      }
    },
    [addText, updateText],
  );

  const handleTextStart = useCallback(
    (point: CanvasPoint) => {
      const state = useCanvasStore.getState();
      const hitShapeId = findTopmostStrokeAtPoint(point);
      const existingText = hitShapeId ? state.doc.texts[hitShapeId] : undefined;

      if (existingText) {
        const textLayer = state.doc.layers.find(
          (candidate) => candidate.id === existingText.layerId,
        );
        if (textLayer?.locked) return;
        commitText();
        state.setSelectedStrokes([existingText.id]);
        state.setActiveColor(existingText.color);

        const fontSize = existingText.fontSize ?? 24;
        setTextDraftState({
          id: crypto.randomUUID(),
          sourceTextId: existingText.id,
          x: existingText.x + (existingText.offset?.x ?? 0),
          y: existingText.y + (existingText.offset?.y ?? 0),
          width: existingText.width,
          height: existingText.height,
          text: existingText.text,
          layerId: existingText.layerId,
          color: existingText.color,
          opacity: existingText.opacity,
          rotation: existingText.rotation ?? 0,
          fontSize,
          fontFamily: existingText.fontFamily ?? "draw",
          textAlign: existingText.textAlign ?? "left",
          bold: existingText.bold ?? false,
          italic: existingText.italic ?? false,
        });
        return;
      }

      const layer = state.doc.layers.find((candidate) => candidate.id === state.ui.activeLayerId);
      if (!layer || layer.locked) return;
      commitText();

      const snapped = snapPoint(point, state.ui.snapToGrid);
      setTextDraftState({
        id: crypto.randomUUID(),
        x: snapped.x,
        y: snapped.y,
        width: TEXT_MIN_WIDTH_PX,
        height: Math.max(TEXT_MIN_HEIGHT_PX, getLineHeight(state.ui.activeFontSize)),
        text: "",
        layerId: layer.id,
        color: state.ui.activeColor,
        opacity: 1,
        rotation: 0,
        fontSize: state.ui.activeFontSize,
        fontFamily: state.ui.activeFontFamily,
        textAlign: state.ui.activeTextAlign,
        bold: false,
        italic: false,
      });
    },
    [commitText, findTopmostStrokeAtPoint, setTextDraftState],
  );

  const handleShapeStart = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean }) => {
      const state = useCanvasStore.getState();
      const layer = state.doc.layers.find((candidate) => candidate.id === state.ui.activeLayerId);
      if (!layer || layer.locked) return;
      const snapped = snapPoint(point, state.ui.snapToGrid);
      setShapeDraftState({
        kind: state.ui.activeTool as ShapeKind,
        startX: snapped.x,
        startY: snapped.y,
        x: snapped.x,
        y: snapped.y,
        width: 0,
        height: 0,
        flipX: false,
        flipY: false,
      });
      void modifiers;
    },
    [setShapeDraftState],
  );

  const handleShapeMove = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean }) => {
      const draft = shapeDraftRef.current;
      if (!draft) return;
      const state = useCanvasStore.getState();
      const snapped = snapPoint(point, state.ui.snapToGrid);

      let width = snapped.x - draft.startX;
      let height = snapped.y - draft.startY;

      if (modifiers.shiftKey) {
        if (draft.kind === "line" || draft.kind === "arrow") {
          // Snap direction to 45° increments.
          const angle = Math.atan2(height, width);
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const length = Math.hypot(width, height);
          width = Math.cos(snappedAngle) * length;
          height = Math.sin(snappedAngle) * length;
        } else {
          const size = Math.max(Math.abs(width), Math.abs(height));
          width = Math.sign(width || 1) * size;
          height = Math.sign(height || 1) * size;
        }
      }

      setShapeDraftState({
        ...draft,
        x: Math.min(draft.startX, draft.startX + width),
        y: Math.min(draft.startY, draft.startY + height),
        width: Math.abs(width),
        height: Math.abs(height),
        flipX: width < 0,
        flipY: height < 0,
      });
    },
    [setShapeDraftState],
  );

  const handleShapeEnd = useCallback(
    (point: CanvasPoint, modifiers: { shiftKey: boolean }) => {
      const draft = shapeDraftRef.current;
      setShapeDraftState(null);
      if (!draft) return;
      const state = useCanvasStore.getState();
      const layer = state.doc.layers.find((candidate) => candidate.id === state.ui.activeLayerId);
      if (!layer || layer.locked) return;

      const isLineish = draft.kind === "line" || draft.kind === "arrow";

      // A quick click (no drag) creates a default-sized shape, like tldraw.
      let { x, y, width, height, flipX, flipY } = draft;
      if (width < SHAPE_MIN_SIZE && height < SHAPE_MIN_SIZE) {
        if (isLineish) {
          width = DEFAULT_LINE_LENGTH;
          height = 0;
        } else {
          width = DEFAULT_SHAPE_WIDTH;
          height = DEFAULT_SHAPE_HEIGHT;
        }
        x = draft.startX - width / 2;
        y = draft.startY - height / 2;
        flipX = false;
        flipY = false;
      }

      const strokeWidth = SHAPE_STROKE_WIDTHS[state.ui.activeShapeSize];
      const bounds = getShapeBounds(x, y, width, height, strokeWidth);
      if (bounds.width < strokeWidth && bounds.height < strokeWidth) return;

      state.addShape({
        kind: draft.kind,
        layerId: layer.id,
        x,
        y,
        width,
        height,
        color: state.ui.activeColor,
        fill: state.ui.activeFill,
        dash: state.ui.activeDash,
        size: state.ui.activeShapeSize,
        opacity: state.ui.activeOpacity,
        flipX,
        flipY,
      });
      void point;
      void modifiers;
    },
    [setShapeDraftState],
  );

  const handleFillStart = useCallback((point: CanvasPoint) => {
    const state = useCanvasStore.getState();
    const layer = state.doc.layers.find((candidate) => candidate.id === state.ui.activeLayerId);
    if (!layer || layer.locked) return;
    const fill: FillInteraction = {
      points: [point],
      layerId: layer.id,
      color: state.ui.activeColor,
      opacity: state.ui.activeOpacity,
    };
    fillRef.current = fill;
    setFillPreview(fill.points);
  }, []);

  const handleFillMove = useCallback((point: CanvasPoint) => {
    const fill = fillRef.current;
    if (!fill) return;
    const lastPoint = fill.points[fill.points.length - 1];
    const minDistance = 2 / cameraRef.current.zoom;
    if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < minDistance) return;
    fill.points.push(point);
    setFillPreview([...fill.points]);
  }, []);

  const handleFillEnd = useCallback(
    (point: CanvasPoint) => {
      const fill = fillRef.current;
      fillRef.current = null;
      setFillPreview(null);
      if (!fill) return;

      const lastPoint = fill.points[fill.points.length - 1];
      if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 1 / cameraRef.current.zoom) {
        fill.points.push(point);
      }

      if (fill.points.length < 3) {
        // Single click: high-performance vector bucket fill!
        const state = useCanvasStore.getState();
        const visibleStrokes = Object.values(state.doc.strokes);
        const fillResult = computeBucketFill({
          seed: point,
          strokes: visibleStrokes,
          maxRadius: Math.max(300, 600 / cameraRef.current.zoom),
        });

        if (fillResult) {
          addStroke({
            id: crypto.randomUUID(),
            pathData: fillResult.pathData,
            points: fillResult.points,
            color: fill.color,
            width: 0,
            opacity: fill.opacity,
            tool: "fill",
            layerId: fill.layerId,
            timestamp: Date.now(),
          });
        }
        return;
      }

      let doubledArea = 0;
      for (let index = 0; index < fill.points.length; index++) {
        const current = fill.points[index];
        const next = fill.points[(index + 1) % fill.points.length];
        doubledArea += current.x * next.y - next.x * current.y;
      }
      if (Math.abs(doubledArea) < 4 / (cameraRef.current.zoom * cameraRef.current.zoom)) return;

      addStroke({
        id: crypto.randomUUID(),
        pathData: getClosedPathData(fill.points),
        points: fill.points.map((point) => ({ ...point, pressure: 0.5 })),
        color: fill.color,
        width: 0,
        opacity: fill.opacity,
        tool: "fill",
        layerId: fill.layerId,
        timestamp: Date.now(),
      });
    },
    [addStroke],
  );

  const { handlePointerDown, handlePointerMove, handlePointerUp, handleWheel } = useCanvasEvents({
    cameraRef,
    rectRef,
    activeTool: ui.activeTool,

    onStrokeStart: (p) => {
      currentInputTypeRef.current = p.pointerType;
      currentPointsRef.current = [{ x: p.x, y: p.y, pressure: p.pressure }];
      lastStablePointRef.current = { x: p.x, y: p.y };
    },

    onStrokeMove: (p) => {
      const points = currentPointsRef.current;
      const lastPoint = points[points.length - 1];
      const lastStable = lastStablePointRef.current;

      if (lastPoint) {
        const dx = p.x - lastPoint.x;
        const dy = p.y - lastPoint.y;

        const dist = Math.hypot(dx, dy);
        const speed = dist;

        const base = 0.75 / cameraRef.current.zoom;
        const threshold = Math.max(base, speed * 0.25);

        if (dist < threshold) return;
      }
      const newPressure = p.pointerType === "pen" ? p.pressure : 0.5;
      if (!lastStable) {
        currentPointsRef.current.push({
          x: p.x,
          y: p.y,
          pressure: newPressure,
        });
        lastStablePointRef.current = { x: p.x, y: p.y };
      } else {
        const dx = p.x - lastStable.x;
        const dy = p.y - lastStable.y;
        const dist = Math.hypot(dx, dy);
        const speed = dist;

        const zoomFactor = Math.sqrt(cameraRef.current.zoom);
        const alpha = Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, (speed * zoomFactor) / V_MAX));

        const sx = lastStable.x + (p.x - lastStable.x) * alpha;
        const sy = lastStable.y + (p.y - lastStable.y) * alpha;

        lastStablePointRef.current = { x: sx, y: sy };

        currentPointsRef.current.push({
          x: sx,
          y: sy,
          pressure: newPressure,
        });
      }

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          renderLiveStroke();
          rafRef.current = null;
        });
      }
    },

    onStrokeEnd: () => {
      if (currentPointsRef.current.length < 2) return;

      const rawPoints = currentPointsRef.current;
      const isPen = currentInputTypeRef.current === "pen";

      const strokeOpts = {
        size: ui.activeWidth,
        ...getBrushProperties(ui.activeBrush),
        smoothing: ui.activeSmooth,
        simulatePressure: !isPen,
      };

      const outline = getStroke(rawPoints, strokeOpts);
      const pathData = getSvgPathFromStroke(outline);

      addStroke({
        id: crypto.randomUUID(),
        pathData,
        points: rawPoints,
        color: ui.activeColor,
        width: ui.activeWidth,
        opacity: ui.activeOpacity,
        tool: ui.activeBrush,
        layerId: ui.activeLayerId,
        timestamp: Date.now(),
      });

      currentPointsRef.current = [];
      lastStablePointRef.current = null;

      const ctx = overlayCanvasRef.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },

    onPanMove: (dx, dy) => {
      const radians = (-cameraRef.current.rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      setCamera({
        ...cameraRef.current,
        x: cameraRef.current.x + (dx * cos - dy * sin),
        y: cameraRef.current.y + (dx * sin + dy * cos),
      });
    },
    onZoom: (newCamera) => {
      setCamera(newCamera);
    },
    onSelectionStart: handleSelectionStart,
    onSelectionMove: handleSelectionMove,
    onSelectionEnd: handleSelectionEnd,
    onTextStart: handleTextStart,
    onNudgeStart: handleNudgeStart,
    onNudgeMove: handleNudgeMove,
    onNudgeEnd: handleNudgeEnd,
    onRotateMove: (dx) => {
      const camera = {
        ...cameraRef.current,
        rotation: cameraRef.current.rotation + dx * 0.35,
      };
      cameraRef.current = camera;
      setCamera(camera);
    },
    onFillStart: handleFillStart,
    onFillMove: handleFillMove,
    onFillEnd: handleFillEnd,
    onShapeStart: handleShapeStart,
    onShapeMove: handleShapeMove,
    onShapeEnd: handleShapeEnd,
  });

  const handleCanvasPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!selectionRef.current) {
        const nextCursor = getTransformCursor(toWorld(event.clientX, event.clientY));
        setHoveredTransformHandle((current) => (current === nextCursor ? current : nextCursor));
      }
      handlePointerMove(event);
    },
    [getTransformCursor, handlePointerMove, toWorld],
  );

  const handleCanvasDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const worldPoint = toWorld(event.clientX, event.clientY);
      const hitShapeId = findTopmostStrokeAtPoint(worldPoint);
      const state = useCanvasStore.getState();
      const existingText = hitShapeId ? state.doc.texts[hitShapeId] : undefined;
      if (existingText) {
        handleTextStart(worldPoint);
        return;
      }
      // tldraw-style: double-clicking empty canvas with the select tool starts a text.
      if (
        hasToolFunction(state.ui.activeTool, "select") ||
        hasToolFunction(state.ui.activeTool, "marquee")
      ) {
        const layer = state.doc.layers.find((candidate) => candidate.id === state.ui.activeLayerId);
        if (!layer || layer.locked) return;
        setTextDraftState({
          id: crypto.randomUUID(),
          x: worldPoint.x,
          y: worldPoint.y - 12,
          width: TEXT_MIN_WIDTH_PX,
          height: getLineHeight(state.ui.activeFontSize),
          text: "",
          layerId: layer.id,
          color: state.ui.activeColor,
          opacity: 1,
          rotation: 0,
          fontSize: state.ui.activeFontSize,
          fontFamily: state.ui.activeFontFamily,
          textAlign: state.ui.activeTextAlign,
          bold: false,
          italic: false,
        });
      }
    },
    [findTopmostStrokeAtPoint, handleTextStart, setTextDraftState, toWorld],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const worldPoint = toWorld(event.clientX, event.clientY);
      const state = useCanvasStore.getState();
      // Right-clicking an unselected shape selects it first.
      if (state.ui.selectedStrokeIds.length === 0) {
        const hitId = findTopmostStrokeAtPoint(worldPoint);
        if (hitId) state.setSelectedStrokes([hitId]);
      }
      state.setContextMenu({
        screen: { x: event.clientX, y: event.clientY },
        world: worldPoint,
      });
    },
    [findTopmostStrokeAtPoint, toWorld],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const cursorClass =
    ui.activeTool === "pan"
      ? "cursor-grab active:cursor-grabbing"
      : hasToolFunction(ui.activeTool, "text")
        ? "cursor-text"
        : ui.activeTool === "select" ||
            hasToolFunction(ui.activeTool, "select") ||
            hasToolFunction(ui.activeTool, "marquee") ||
            hasToolFunction(ui.activeTool, "nudge")
          ? "cursor-default"
          : "cursor-crosshair";
  const cursor =
    hoveredTransformHandle === "rotate"
      ? ROTATE_CURSOR
      : hoveredTransformHandle === "scale"
        ? "nwse-resize"
        : hoveredTransformHandle === "move"
          ? "move"
          : undefined;
  const viewportCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const cameraTransform = `translate(${viewportCenter.x}, ${viewportCenter.y}) rotate(${ui.camera.rotation}) translate(${-viewportCenter.x}, ${-viewportCenter.y}) translate(${ui.camera.x}, ${ui.camera.y}) scale(${ui.camera.zoom})`;

  const canvasBackground = ui.canvasBackground ?? {
    type: CanvasBackgroundType.White,
    color: "#ffffff",
  };
  const currentTexture = BACKGROUND_TEXTURES[canvasBackground.type];

  let backgroundStyle: React.CSSProperties = { backgroundColor: "#ffffff" };
  if (canvasBackground.type === CanvasBackgroundType.Transparent) {
    backgroundStyle = {
      backgroundImage:
        "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
      backgroundColor: "#ffffff",
    };
  } else if (currentTexture) {
    backgroundStyle = {
      backgroundColor: currentTexture.fallbackColor,
      backgroundImage: `url("${currentTexture.src}")`,
      backgroundRepeat: "repeat",
      backgroundSize: `${currentTexture.width}px ${currentTexture.height}px`,
    };
  } else if (canvasBackground.type === CanvasBackgroundType.Darkprint) {
    backgroundStyle = { backgroundColor: "#1d252b" };
  } else if (canvasBackground.type === CanvasBackgroundType.Custom) {
    backgroundStyle = { backgroundColor: canvasBackground.color || "#ffffff" };
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden touch-none overscroll-none select-none ${cursorClass}`}
      style={{ cursor, ...backgroundStyle }}
      onPointerDown={handlePointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoveredTransformHandle(null)}
      onDoubleClick={handleCanvasDoubleClick}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
    >
      <svg
        id="canvas-svg"
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        shapeRendering="geometricPrecision"
      >
        <defs>
          {currentTexture && (
            <pattern
              id={`canvas-bg-pattern-${canvasBackground.type}`}
              width={currentTexture.width}
              height={currentTexture.height}
              patternUnits="userSpaceOnUse"
            >
              <image
                href={currentTexture.src}
                xlinkHref={currentTexture.src}
                width={currentTexture.width}
                height={currentTexture.height}
                preserveAspectRatio="none"
              />
            </pattern>
          )}
        </defs>
        <g transform={cameraTransform}>
          {currentTexture && (
            <rect
              x="-500000"
              y="-500000"
              width="1000000"
              height="1000000"
              fill={`url(#canvas-bg-pattern-${canvasBackground.type})`}
            />
          )}
          <Grid camera={ui.camera} />
          <Renderer editingTextId={textDraft?.sourceTextId} />
          {shapeDraft && (
            <ShapePreview
              kind={shapeDraft.kind}
              x={shapeDraft.x}
              y={shapeDraft.y}
              width={shapeDraft.width}
              height={shapeDraft.height}
              flipX={shapeDraft.flipX}
              flipY={shapeDraft.flipY}
              color={ui.activeColor}
              fill={ui.activeFill}
              dash={ui.activeDash}
              size={ui.activeShapeSize}
              opacity={ui.activeOpacity}
            />
          )}
          {fillPreview && fillPreview.length > 1 && (
            <path
              d={getClosedPathData(fillPreview)}
              fill={ui.activeColor}
              fillOpacity={Math.min(ui.activeOpacity, 0.3)}
              stroke={ui.activeColor}
              strokeWidth={1 / ui.camera.zoom}
              strokeLinejoin="round"
            />
          )}
          <SelectionOverlay editingTextId={textDraft?.sourceTextId ?? textDraft?.id} />
        </g>
      </svg>
      {ui.showSpatialIndexStats && <SpatialIndexStats />}
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      {textDraft && (
        <>
          <svg className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
            <g transform={cameraTransform}>
              {/* 4 Protruding Lines */}
              <g stroke="#3b82f6" strokeWidth={0.5 / ui.camera.zoom} opacity={0.35}>
                <line x1={textDraft.x} y1={-500000} x2={textDraft.x} y2={500000} />
                <line
                  x1={textDraft.x + textDraft.width}
                  y1={-500000}
                  x2={textDraft.x + textDraft.width}
                  y2={500000}
                />
                <line x1={-500000} y1={textDraft.y} x2={500000} y2={textDraft.y} />
                <line
                  x1={-500000}
                  y1={textDraft.y + textDraft.height}
                  x2={500000}
                  y2={textDraft.y + textDraft.height}
                />
              </g>

              {/* Text Bounding Box */}
              <rect
                x={textDraft.x}
                y={textDraft.y}
                width={textDraft.width}
                height={textDraft.height}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1 / ui.camera.zoom}
                strokeDasharray={`${3 / ui.camera.zoom} ${3 / ui.camera.zoom}`}
              />

              {/* 4 Corner Circles */}
              {[
                [textDraft.x, textDraft.y],
                [textDraft.x + textDraft.width, textDraft.y],
                [textDraft.x + textDraft.width, textDraft.y + textDraft.height],
                [textDraft.x, textDraft.y + textDraft.height],
              ].map(([cx, cy], i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={3.5 / ui.camera.zoom}
                  fill="#ffffff"
                  stroke="#3b82f6"
                  strokeWidth={1.5 / ui.camera.zoom}
                />
              ))}
            </g>
          </svg>
          <textarea
            ref={textAreaRef}
            value={textDraft.text}
            placeholder="Type text here..."
            wrap="off"
            autoFocus
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const element = event.currentTarget;
              const current = textDraftRef.current;
              if (!current) return;
              const lines = element.value.split("\n");
              const lineHeight = getLineHeight(current.fontSize);
              const charWidth = current.fontSize * 0.6;
              const maxLineLength = Math.max(...lines.map((l) => l.length), 0);
              const width = Math.max(
                TEXT_MIN_WIDTH_PX,
                Math.max(element.scrollWidth, maxLineLength * charWidth + 12),
              );
              const height = Math.max(
                getLineHeight(current.fontSize),
                Math.max(element.scrollHeight, lines.length * lineHeight),
              );
              setTextDraftState({
                ...current,
                text: element.value,
                width,
                height,
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                commitText(textDraft.id);
              } else if (event.key === "Escape") {
                event.preventDefault();
                commitText(textDraft.id);
              }
            }}
            onBlur={() => commitText(textDraft.id)}
            className="absolute z-20 resize-none overflow-hidden outline-none select-text placeholder:text-neutral-400"
            style={{
              left: 0,
              top: 0,
              width: textDraft.width,
              height: textDraft.height,
              minWidth: TEXT_MIN_WIDTH_PX,
              minHeight: getLineHeight(textDraft.fontSize),
              padding: 0,
              margin: 0,
              backgroundColor: "transparent",
              border: "none",
              color: textDraft.color,
              caretColor: "#3b82f6",
              fontFamily: getFontStack(textDraft.fontFamily),
              fontSize: `${textDraft.fontSize}px`,
              fontWeight: textDraft.bold ? 700 : 500,
              fontStyle: textDraft.italic ? "italic" : undefined,
              lineHeight: `${getLineHeight(textDraft.fontSize)}px`,
              textAlign: textDraft.textAlign,
              whiteSpace: "pre",
              transform: `translate(${viewportCenter.x}px, ${viewportCenter.y}px) rotate(${ui.camera.rotation}deg) translate(${-viewportCenter.x}px, ${-viewportCenter.y}px) translate(${ui.camera.x}px, ${ui.camera.y}px) scale(${ui.camera.zoom}) translate(${textDraft.x}px, ${textDraft.y}px)${textDraft.rotation ? ` rotate(${textDraft.rotation}deg)` : ""}`,
              transformOrigin: "0 0",
            }}
          />
        </>
      )}
      <StyleBar />
      <ContextMenu />
    </div>
  );
};
