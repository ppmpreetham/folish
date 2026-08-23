import { useRef, useState, useEffect, useCallback } from "react";
import { COLOR_WHEEL_IDS, COPIC_COLORS } from "../../utils/colors";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useCanvasStore } from "../../stores/canvasStore";
import {
  ArrowCounterClockwise as ArrowCounterClockwiseIcon,
  ArrowClockwise as ArrowClockwiseIcon,
  ScribbleLoop as ScribbleLoopIcon,
  Gradient as GradientIcon,
  CircleHalf as CircleHalfIcon,
} from "phosphor-react";
import { BRUSHES, TOOLS } from "../../utils/toolsData";
import SideBar from "./Sidebar";
import { getContrastColor } from "../../utils/rgb";

const BORDER_COLOR = "#ffffff";
const MIDDLE_BG_COLOR = "#374151";
const OUTER_BG_COLOR = "#1f2937";

const SIZE = 1000;
const MIN_RADIUS = 250;
const MAX_RADIUS = 400;
const RING_GAP = 0;

const CENTER_INNER_R = 40;
const CENTER_MIDDLE_R = 80;
const CENTER_OUTER_R = 120;
const MIDDLE_OFFSET = Math.PI;
const OUTER_OFFSET = -18 * (Math.PI / 180);

const DPR = Math.min(window.devicePixelRatio || 1, 2);
const SECTIONS = 69;
const FRICTION = 0.95;

interface SwatchData {
  color: string;
  code: string;
  path: Path2D;
  swatchCenterX: number;
  swatchCenterY: number;
  element: { scale: number; alpha: number; hoverScale: number };
}

interface CenterRingData {
  id: number;
  type: "middle" | "outer";
  path: Path2D;
  centerX: number;
  centerY: number;
  element: { scale: number; alpha: number; hoverAlpha: number };
}

const cx = SIZE / 2;
const cy = SIZE / 2;
const domLabels = [
  ...[0, 1, 2].map((i) => {
    const midStep = (Math.PI * 2) / 3;
    const aStart = i * midStep - Math.PI / 2 + MIDDLE_OFFSET;
    const aEnd = aStart + midStep;
    const midA = (aStart + aEnd) / 2;
    const midR = (CENTER_INNER_R + CENTER_MIDDLE_R) / 2;
    return {
      id: i,
      type: "middle",
      cx: cx + Math.cos(midA) * midR,
      cy: cy + Math.sin(midA) * midR,
    };
  }),
  ...Array.from({ length: 10 }).map((_, i) => {
    const outerStep = (Math.PI * 2) / 10;
    const aStart = i * outerStep - Math.PI / 2 + OUTER_OFFSET;
    const aEnd = aStart + outerStep;
    const midA = (aStart + aEnd) / 2;
    const midR = (CENTER_MIDDLE_R + CENTER_OUTER_R) / 2;
    return { id: i, type: "outer", cx: cx + Math.cos(midA) * midR, cy: cy + Math.sin(midA) * midR };
  }),
];

const ColorPicker = ({ onChange }: { onChange?: (hex: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitTestCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const swatchesRef = useRef<SwatchData[]>([]);

  const centerCorePathRef = useRef<Path2D>(new Path2D());
  const centerSegmentsRef = useRef<CenterRingData[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [isSliderOpen, setIsSliderOpen] = useState(false);

  const activeColor = useCanvasStore((state) => state.ui.activeColor);
  const activeTool = useCanvasStore((state) => state.ui.activeTool);
  const setActiveColor = useCanvasStore((state) => state.setActiveColor);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const setActiveBrush = useCanvasStore((state) => state.setActiveBrush);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const sidebarOpen = useCanvasStore((state) => state.ui.sidebarOpen);
  const setSidebarOpen = useCanvasStore((state) => state.setSidebarOpen);
  const setEditingOption = useCanvasStore((state) => state.setEditingOption);
  const toolSlots = useCanvasStore((state) => state.ui.toolSlots);

  const activeWidth = useCanvasStore((state) => state.ui.activeWidth);
  const setActiveWidth = useCanvasStore((state) => state.setActiveWidth);
  const activeOpacity = useCanvasStore((state) => state.ui.activeOpacity);
  const setActiveOpacity = useCanvasStore((state) => state.setActiveOpacity);
  const activeSmooth = useCanvasStore((state) => state.ui.activeSmooth);
  const setActiveSmooth = useCanvasStore((state) => state.setActiveSmooth);
  const canPickColors = activeTool === "pen" || activeTool === "fill";

  const isOpenRef = useRef(isOpen);
  const sidebarOpenRef = useRef(sidebarOpen);
  const activeColorRef = useRef(activeColor);
  const activeOuterRef = useRef<number>(5);

  const [activeMiddle, setActiveMiddle] = useState(0);
  const activeMiddleRef = useRef<number>(0);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isTouchRef = useRef(false);
  const lastMouseAngleRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastOuterClickRef = useRef({ id: -1, time: 0 });

  const { contextSafe } = useGSAP();

  const containerRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMovingPickerRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const wasDraggingRef = useRef(false);

  const pointerDownOnCoreRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (isMovingPickerRef.current && containerRef.current) {
        gsap.set(containerRef.current, {
          x: e.clientX - dragOffsetRef.current.x,
          y: e.clientY - dragOffsetRef.current.y,
        });
      }
    };

    const handleGlobalPointerUp = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (isMovingPickerRef.current) {
        wasDraggingRef.current = true;
        isMovingPickerRef.current = false;
        gsap.to(containerRef.current, { scale: 1, duration: 0.2 });
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const globalRotation = rotationRef.current;
    const currentActiveColor = activeColorRef.current;

    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(globalRotation);
    ctx.translate(-SIZE / 2, -SIZE / 2);

    let selectedSwatchData: SwatchData | null = null;
    swatchesRef.current.forEach((swatch) => {
      if (swatch.element.alpha <= 0) return;
      if (swatch.color.toLowerCase() === currentActiveColor?.toLowerCase()) {
        selectedSwatchData = swatch;
        return;
      }
      drawSwatch(ctx, swatch);
    });

    if (selectedSwatchData) {
      drawSwatch(ctx, selectedSwatchData, true);
    }
    ctx.restore();

    ctx.save();

    ctx.lineWidth = 0.25;
    ctx.strokeStyle = BORDER_COLOR;

    centerSegmentsRef.current.forEach((seg) => {
      if (seg.element.alpha <= 0) return;

      ctx.save();
      ctx.globalAlpha = seg.element.alpha;

      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.scale(seg.element.scale, seg.element.scale);
      ctx.translate(-SIZE / 2, -SIZE / 2);

      const isActive =
        (seg.type === "middle" && seg.id === activeMiddleRef.current) ||
        (seg.type === "outer" && seg.id === activeOuterRef.current);

      ctx.beginPath();

      if (isActive) {
        ctx.fillStyle = currentActiveColor || "#ff69b4";
      } else {
        ctx.fillStyle = seg.type === "middle" ? MIDDLE_BG_COLOR : OUTER_BG_COLOR;
      }
      ctx.fill(seg.path);

      if (!isActive && seg.element.hoverAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${seg.element.hoverAlpha * 0.15})`;
        ctx.fill(seg.path);
      }

      ctx.stroke(seg.path);
      ctx.restore();

      const domEl = document.getElementById(`seg-label-${seg.type}-${seg.id}`);
      if (domEl) {
        const newX = SIZE / 2 + (seg.centerX - SIZE / 2) * seg.element.scale;
        const newY = SIZE / 2 + (seg.centerY - SIZE / 2) * seg.element.scale;
        domEl.style.left = `${newX}px`;
        domEl.style.top = `${newY}px`;
        domEl.style.transform = `translate(-50%, -50%) scale(${seg.element.scale})`;
        domEl.style.opacity = `${seg.element.alpha}`;

        if (isActive) {
          domEl.style.color = getContrastColor(currentActiveColor || "#ff69b4");
        } else {
          const colorValue = Math.round(156 + seg.element.hoverAlpha * (255 - 156));
          domEl.style.color = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;
        }

        domEl.style.textShadow = "none";
      }
    });

    ctx.beginPath();
    ctx.fillStyle = currentActiveColor || "#ff69b4";
    ctx.fill(centerCorePathRef.current);
    ctx.stroke(centerCorePathRef.current);

    const fallbackColor = "#FF69B4";
    const centerTextColor = getContrastColor(currentActiveColor || fallbackColor);

    ctx.fillStyle = centerTextColor;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(currentActiveColor || fallbackColor, SIZE / 2, SIZE / 2);

    ctx.restore();
  }, []);

  // Sync state to ref for redrawCanvas closures
  useEffect(() => {
    activeMiddleRef.current = activeMiddle;
    redrawCanvas();
  }, [activeMiddle, redrawCanvas]);

  useEffect(() => {
    activeColorRef.current = activeColor;
    redrawCanvas();
  }, [activeColor, redrawCanvas]);

  const drawSwatch = (ctx: CanvasRenderingContext2D, swatch: SwatchData, isSelected = false) => {
    ctx.save();
    ctx.globalAlpha = swatch.element.alpha;
    const combinedScale = swatch.element.scale * swatch.element.hoverScale;

    ctx.translate(swatch.swatchCenterX, swatch.swatchCenterY);
    ctx.scale(combinedScale, combinedScale);
    ctx.translate(-swatch.swatchCenterX, -swatch.swatchCenterY);

    ctx.fillStyle = swatch.color;
    ctx.fill(swatch.path);

    if (isSelected) {
      ctx.strokeStyle = getContrastColor(swatch.color);
      ctx.lineWidth = 2;
      ctx.stroke(swatch.path);
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke(swatch.path);
    }
    ctx.restore();
  };

  const updateInertia = useCallback(() => {
    if (!isDraggingRef.current && Math.abs(velocityRef.current) > 0.001) {
      rotationRef.current += velocityRef.current;
      velocityRef.current *= FRICTION;
      redrawCanvas();
      rafRef.current = requestAnimationFrame(updateInertia);
    } else {
      velocityRef.current = 0;
    }
  }, [redrawCanvas]);

  const getMouseCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;

    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;

    const unrotated = { x, y };

    const cos = Math.cos(-rotationRef.current);
    const sin = Math.sin(-rotationRef.current);
    const rotated = {
      x: SIZE / 2 + (dx * cos - dy * sin),
      y: SIZE / 2 + (dx * sin + dy * cos),
    };

    return { unrotated, rotated };
  };

  const getMouseAngle = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return Math.atan2(
      clientY - (rect.top + rect.height / 2),
      clientX - (rect.left + rect.width / 2),
    );
  };

  const toggleWheel = useCallback(
    contextSafe((open: boolean) => {
      gsap.to(
        swatchesRef.current.map((s) => s.element),
        {
          scale: open ? 1 : 0,
          alpha: open ? 1 : 0,
          duration: 0.4,
          ease: open ? "back.out(1.4)" : "power2.inOut",
          stagger: 0.001,
          onUpdate: redrawCanvas,
        },
      );
    }),
    [contextSafe, redrawCanvas],
  );

  useEffect(() => {
    if (canPickColors) return;
    setIsOpen(false);
    setIsSliderOpen(false);
    toggleWheel(false);
  }, [canPickColors, toggleWheel]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const { unrotated, rotated } = getMouseCoords(e.clientX, e.clientY);
    isTouchRef.current = e.pointerType === "touch";

    pointerDownOnCoreRef.current = false;
    const isCore = hitTestCtxRef.current!.isPointInPath(
      centerCorePathRef.current,
      unrotated.x,
      unrotated.y,
    );

    if (isCore) {
      if (!canPickColors) return;
      pointerDownOnCoreRef.current = true;
      setIsSliderOpen(false);

      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      isMovingPickerRef.current = false;

      const currentX = (gsap.getProperty(containerRef.current, "x") as number) || 0;
      const currentY = (gsap.getProperty(containerRef.current, "y") as number) || 0;
      dragOffsetRef.current = {
        x: e.clientX - currentX,
        y: e.clientY - currentY,
      };

      holdTimerRef.current = setTimeout(() => {
        isMovingPickerRef.current = true;
        pointerDownOnCoreRef.current = false;
        gsap.to(containerRef.current, { scale: 1.05, duration: 0.2 });
        document.body.style.cursor = "grabbing";
      }, 1000);
      return;
    }

    let clickedCenter = false;
    centerSegmentsRef.current.forEach((seg) => {
      if (hitTestCtxRef.current!.isPointInPath(seg.path, unrotated.x, unrotated.y)) {
        if (seg.type === "middle") {
          if (activeMiddleRef.current === seg.id) {
            setIsSliderOpen((prev) => !prev);
          } else {
            setActiveMiddle(seg.id);
            setIsSliderOpen(true);
          }
        } else {
          activeOuterRef.current = seg.id;
          const now = Date.now();
          const isDoubleClick =
            lastOuterClickRef.current.id === seg.id && now - lastOuterClickRef.current.time < 300;
          lastOuterClickRef.current = { id: seg.id, time: now };

          if (seg.id === 7) {
            undo();
          } else if (seg.id === 8) {
            redo();
          } else {
            if (isDoubleClick) {
              setEditingOption(seg.id);
              setSidebarOpen(true);
            } else {
              const assignment = toolSlots[seg.id];
              if (!assignment) return;
              if (assignment.type === "brush") {
                setActiveBrush(assignment.id);
                setActiveTool(assignment.id === "fill" ? "fill" : "pen");
              } else if (assignment.type === "tool") {
                const tool = TOOLS.find((item) => item.id === assignment.id);
                if (tool) setActiveTool(tool.id);
              }
            }
          }
        }
        clickedCenter = true;
      }
    });

    if (clickedCenter) {
      redrawCanvas();
      return;
    }

    if (!isOpenRef.current) return;

    const clickedSwatch = swatchesRef.current.find((s) =>
      hitTestCtxRef.current!.isPointInPath(s.path, rotated.x, rotated.y),
    );

    if (clickedSwatch) {
      setActiveColor(clickedSwatch.color);
      if (onChange) onChange(clickedSwatch.color);
      setIsOpen(false);
      setIsSliderOpen(false);
      toggleWheel(false);
      return;
    }

    const dist = Math.sqrt(
      Math.pow(unrotated.x - SIZE / 2, 2) + Math.pow(unrotated.y - SIZE / 2, 2),
    );

    if (dist > MAX_RADIUS) {
      setIsOpen(false);
      setIsSliderOpen(false);
      toggleWheel(false);
      return;
    }

    isDraggingRef.current = true;
    velocityRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    lastMouseAngleRef.current = getMouseAngle(e.clientX, e.clientY);
  };

  const handlePointerMove = contextSafe((e: React.PointerEvent) => {
    if (isDraggingRef.current && isOpenRef.current) {
      const currentAngle = getMouseAngle(e.clientX, e.clientY);
      const delta = currentAngle - lastMouseAngleRef.current;
      rotationRef.current += delta;

      if (Math.abs(delta) > 0.01 && holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        pointerDownOnCoreRef.current = false;
      }

      if (isTouchRef.current) {
        velocityRef.current = delta;
      }

      lastMouseAngleRef.current = currentAngle;
      redrawCanvas();
      return;
    }

    const { unrotated, rotated } = getMouseCoords(e.clientX, e.clientY);

    centerSegmentsRef.current.forEach((seg) => {
      const isHovered = hitTestCtxRef.current!.isPointInPath(seg.path, unrotated.x, unrotated.y);
      const target = isHovered ? 1 : 0;
      if (seg.element.hoverAlpha !== target) {
        gsap.to(seg.element, {
          hoverAlpha: target,
          duration: 0.15,
          overwrite: "auto",
          onUpdate: redrawCanvas,
        });
      }
    });

    if (!isOpenRef.current) return;

    swatchesRef.current.forEach((s) => {
      const isHovered = hitTestCtxRef.current!.isPointInPath(s.path, rotated.x, rotated.y);
      const target = isHovered ? 1.15 : 1;
      if (s.element.hoverScale !== target) {
        gsap.to(s.element, {
          hoverScale: target,
          duration: 0.15,
          overwrite: "auto",
          onUpdate: redrawCanvas,
        });
      }
    });
  });

  const handlePointerUp = () => {
    if (pointerDownOnCoreRef.current) {
      const newState = !isOpenRef.current;
      setIsOpen(newState);
      setIsSliderOpen(false);
      toggleWheel(newState);
      pointerDownOnCoreRef.current = false;
    }

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (isTouchRef.current && Math.abs(velocityRef.current) > 0.001) {
        rafRef.current = requestAnimationFrame(updateInertia);
      }
    }
  };

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!isOpenRef.current || !canPickColors) return;
      e.preventDefault();
      rotationRef.current += e.deltaY * 0.002;
      redrawCanvas();
    },
    [canPickColors, redrawCanvas],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideCanvas = canvas && !canvas.contains(target);
      const sidebarEl = document.getElementById("sidebar-container");
      const isOutsideSidebar = sidebarEl ? !sidebarEl.contains(target) : true;
      const proxyEl = document.getElementById("proxy-hit-area");
      const isOutsideProxy = proxyEl ? !proxyEl.contains(target) : true;
      const sliderEl = document.getElementById("popout-slider");
      const isOutsideSlider = sliderEl ? !sliderEl.contains(target) : true;

      if (isOutsideCanvas && isOutsideSidebar && isOutsideProxy && isOutsideSlider) {
        if (isOpenRef.current) {
          setIsOpen(false);
          toggleWheel(false);
        }
        setSidebarOpen(false);
        setIsSliderOpen(false);
      }
    };

    window.addEventListener("mousedown", handleOutside);
    if (canvas) {
      canvas.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener("mousedown", handleOutside);
      canvas?.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleWheel, toggleWheel, setSidebarOpen]);

  useGSAP(() => {
    if (containerRef.current) {
      gsap.set(containerRef.current, {
        x: window.innerHeight * 0.15,
        y: window.innerHeight * 0.15,
        xPercent: -50,
        yPercent: -50,
      });
    }

    const hitCanvas = document.createElement("canvas");
    hitCanvas.width = SIZE;
    hitCanvas.height = SIZE;
    hitTestCtxRef.current = hitCanvas.getContext("2d");

    const canvas = canvasRef.current!;
    canvas.width = SIZE * DPR;
    canvas.height = SIZE * DPR;
    canvas.style.width = canvas.style.height = `${SIZE}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(DPR, DPR);

    const angleStep = (Math.PI * 2) / SECTIONS;

    centerCorePathRef.current = new Path2D();
    centerCorePathRef.current.arc(cx, cy, CENTER_INNER_R, 0, Math.PI * 2);

    const newCenterSegments: CenterRingData[] = [];

    const midStep = (Math.PI * 2) / 3;
    for (let i = 0; i < 3; i++) {
      const aStart = i * midStep - Math.PI / 2 + MIDDLE_OFFSET;
      const aEnd = aStart + midStep;
      const path = new Path2D();
      path.arc(cx, cy, CENTER_INNER_R, aStart, aEnd);
      path.arc(cx, cy, CENTER_MIDDLE_R, aEnd, aStart, true);
      path.closePath();

      const midA = (aStart + aEnd) / 2;
      const midR = (CENTER_INNER_R + CENTER_MIDDLE_R) / 2;

      newCenterSegments.push({
        id: i,
        type: "middle",
        path,
        centerX: cx + Math.cos(midA) * midR,
        centerY: cy + Math.sin(midA) * midR,
        element: { scale: 1, alpha: 1, hoverAlpha: 0 },
      });
    }

    const outerStep = (Math.PI * 2) / 10;
    for (let i = 0; i < 10; i++) {
      const aStart = i * outerStep - Math.PI / 2 + OUTER_OFFSET;
      const aEnd = aStart + outerStep;
      const path = new Path2D();
      path.arc(cx, cy, CENTER_MIDDLE_R, aStart, aEnd);
      path.arc(cx, cy, CENTER_OUTER_R, aEnd, aStart, true);
      path.closePath();

      const midA = (aStart + aEnd) / 2;
      const midR = (CENTER_MIDDLE_R + CENTER_OUTER_R) / 2;

      newCenterSegments.push({
        id: i,
        type: "outer",
        path,
        centerX: cx + Math.cos(midA) * midR,
        centerY: cy + Math.sin(midA) * midR,
        element: { scale: 1, alpha: 1, hoverAlpha: 0 },
      });
    }
    centerSegmentsRef.current = newCenterSegments;

    const newSwatches: SwatchData[] = [];
    const sectionWidth = (MAX_RADIUS - MIN_RADIUS) / COLOR_WHEEL_IDS.length;

    COLOR_WHEEL_IDS.forEach((circle, circleIdx) => {
      const baseRIn = MIN_RADIUS + circleIdx * sectionWidth;
      const rIn = baseRIn + (circleIdx > 0 ? RING_GAP / 2 : 0);
      const rOut =
        baseRIn + sectionWidth - (circleIdx < COLOR_WHEEL_IDS.length - 1 ? RING_GAP / 2 : 0);

      circle.forEach((id, sIdx) => {
        const hex = COPIC_COLORS[id as keyof typeof COPIC_COLORS];
        if (!hex) return;

        const aStart = sIdx * angleStep - Math.PI / 2;
        const aEnd = aStart + angleStep;

        const path = new Path2D();
        path.arc(cx, cy, rIn, aStart, aEnd);
        path.arc(cx, cy, rOut, aEnd, aStart, true);
        path.closePath();

        newSwatches.push({
          color: hex,
          code: id,
          path,
          swatchCenterX: cx + Math.cos((aStart + aEnd) / 2) * ((rIn + rOut) / 2),
          swatchCenterY: cy + Math.sin((aStart + aEnd) / 2) * ((rIn + rOut) / 2),
          element: { scale: 0, alpha: 0, hoverScale: 1 },
        });
      });
    });

    swatchesRef.current = newSwatches;
    redrawCanvas();
  }, []);

  const activeToolName = activeMiddle === 0 ? "SIZE" : activeMiddle === 1 ? "SMOOTH" : "OPACITY";
  const ActiveLeftIcon =
    activeMiddle === 0 ? GradientIcon : activeMiddle === 1 ? ScribbleLoopIcon : CircleHalfIcon;
  const ActiveRightIcon =
    activeMiddle === 0 ? GradientIcon : activeMiddle === 1 ? ScribbleLoopIcon : CircleHalfIcon;

  return (
    <>
      <div
        ref={containerRef}
        className="fixed top-0 left-0 z-50 pointer-events-none"
        style={{ width: SIZE, height: SIZE }}
      >
        {/* SLIDER POP-OUT UI */}
        {isSliderOpen && (
          <div
            id="popout-slider"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-1/2 left-1/2 -translate-y-1/2 rounded-r-xl pointer-events-auto border-y border-r border-gray-600 flex flex-col justify-center animate-in fade-in slide-in-from-left-8 duration-200 z-0"
            style={{
              backgroundColor: MIDDLE_BG_COLOR,
              width: "320px",
              height: "110px",
              marginLeft: `${CENTER_OUTER_R - 20}px`,
              paddingLeft: "40px",
              paddingRight: "20px",
            }}
          >
            <div className="flex justify-between items-center text-xs text-gray-300 mb-2 font-semibold">
              <span>0%</span>
              <span>50%</span>
              <span>70%</span>
              <div className="bg-white text-black px-2 py-1 rounded text-center min-w-10">
                {activeMiddle === 0
                  ? Math.round((activeWidth / 100) * 100)
                  : activeMiddle === 1
                    ? Math.round(activeSmooth * 100)
                    : Math.round(activeOpacity * 100)}
                %
              </div>
            </div>

            <div className="relative w-full h-4 my-2 flex items-center">
              <div className="absolute w-full h-1 bg-gray-500 rounded pointer-events-none"></div>
              <div className="absolute left-[50%] top-1/2 -translate-y-1/2 w-0.5 h-3 bg-gray-300 pointer-events-none"></div>
              <div className="absolute left-[70%] top-1/2 -translate-y-1/2 w-0.5 h-3 bg-gray-300 pointer-events-none"></div>
              <input
                type="range"
                className="absolute w-full opacity-0 cursor-pointer h-full z-10"
                min={activeMiddle === 0 ? 1 : 0}
                max={activeMiddle === 0 ? 100 : 1}
                step={activeMiddle === 0 ? 1 : 0.01}
                value={
                  activeMiddle === 0
                    ? activeWidth
                    : activeMiddle === 1
                      ? activeSmooth
                      : activeOpacity
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (activeMiddle === 0) setActiveWidth(val);
                  else if (activeMiddle === 1) setActiveSmooth(val);
                  else setActiveOpacity(val);
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full pointer-events-none"
                style={{
                  left: `calc(${
                    activeMiddle === 0
                      ? (activeWidth / 100) * 100
                      : activeMiddle === 1
                        ? activeSmooth * 100
                        : activeOpacity * 100
                  }% - 8px)`,
                }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-xs text-gray-300 mt-2 font-bold tracking-widest">
              <ActiveLeftIcon size={16} />
              <span>{activeToolName}</span>
              <ActiveRightIcon size={16} weight={activeMiddle === 1 ? "bold" : "fill"} />
            </div>
          </div>
        )}

        <div
          id="proxy-hit-area"
          className="absolute top-1/2 left-1/2 pointer-events-auto rounded-full z-10"
          style={{
            width: CENTER_OUTER_R * 2,
            height: CENTER_OUTER_R * 2,
            transform: "translate(-50%, -50%)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        <div
          className="absolute top-1/2 left-1/2 pointer-events-none z-20"
          style={{ width: SIZE, height: SIZE, transform: "translate(-50%, -50%)" }}
        >
          {domLabels.map((label) => {
            let content = null;

            if (label.type === "middle") {
              if (label.id === 0) content = <GradientIcon size={24} weight="bold" />;
              else if (label.id === 1) content = <ScribbleLoopIcon size={24} weight="bold" />;
              else content = <CircleHalfIcon size={24} weight="fill" />;
            } else {
              if (label.id === 7) {
                content = <ArrowCounterClockwiseIcon size={26} weight="bold" />;
              } else if (label.id === 8) {
                content = <ArrowClockwiseIcon size={26} weight="bold" />;
              } else {
                const assignment = toolSlots[label.id];
                if (assignment) {
                  const item =
                    assignment.type === "brush"
                      ? BRUSHES.find((b) => b.id === assignment.id)
                      : TOOLS.find((t) => t.id === assignment.id);
                  if (item && item.logo) {
                    const Logo = item.logo;
                    content = <Logo size={24} weight="fill" />;
                  } else {
                    content = <span>{label.id + 1}</span>;
                  }
                } else {
                  content = <span>{label.id + 1}</span>;
                }
              }
            }

            return (
              <div
                key={`${label.type}-${label.id}`}
                id={`seg-label-${label.type}-${label.id}`}
                className="absolute flex items-center justify-center font-bold text-base pointer-events-none transition-shadow"
                style={{
                  left: label.cx,
                  top: label.cy,
                  transform: "translate(-50%, -50%) scale(1)",
                  opacity: 1,
                  color: "#9ca3af",
                }}
              >
                {content}
              </div>
            );
          })}
        </div>

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="touch-none select-none absolute top-1/2 left-1/2 bg-transparent z-10"
          style={{
            width: SIZE,
            height: SIZE,
            transform: "translate(-50%, -50%)",
            pointerEvents: isOpen && canPickColors ? "auto" : "none",
            cursor: isOpen && canPickColors ? "grab" : "default",
            transition: "opacity 0.3s ease-in-out",
          }}
        />
      </div>
      {sidebarOpen && <SideBar />}
    </>
  );
};

export default ColorPicker;
