import { type FC, useMemo } from "react"
import { Camera, CanvasBackground, CanvasBackgroundType, GridType } from "../../types"
import { useCanvasStore } from "../../stores/canvasStore"

interface GridProps {
  camera: Camera
}

function getGridStrokeColor(bg: CanvasBackground): string {
  if (bg.type === CanvasBackgroundType.Darkprint) {
    return "rgba(255, 255, 255, 0.18)"
  }
  if (bg.type === CanvasBackgroundType.Blueprint) {
    return "rgba(255, 255, 255, 0.32)"
  }
  if (bg.type === CanvasBackgroundType.Brown) {
    return "rgba(50, 25, 5, 0.2)"
  }
  if (bg.type === CanvasBackgroundType.Crumpled) {
    return "rgba(40, 40, 50, 0.22)"
  }
  if (bg.type === CanvasBackgroundType.Custom) {
    const hex = bg.color.replace("#", "")
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      return luminance < 0.5 ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.16)"
    }
  }
  return "rgba(0, 0, 0, 0.14)"
}

export const Grid: FC<GridProps> = ({ camera }) => {
  const gridType = useCanvasStore((state) => state.ui.gridType)
  const canvasBackground = useCanvasStore((state) => state.ui.canvasBackground)

  const strokeColor = useMemo(() => getGridStrokeColor(canvasBackground), [canvasBackground])
  const strokeWidth = 1 / camera.zoom
  const horizonStrokeWidth = 2 / camera.zoom

  const gridSize = 80
  const R = 500000

  // 1-Point Perspective: rays from origin (0, 0)
  const onePointRays = useMemo(() => {
    if (gridType !== GridType.OnePoint) return []
    const rays: Array<{ x2: number; y2: number }> = []
    const count = 36
    for (let i = 0; i < count; i++) {
      const angle = (i * (360 / count) * Math.PI) / 180
      rays.push({
        x2: Math.cos(angle) * R,
        y2: Math.sin(angle) * R,
      })
    }
    return rays
  }, [gridType])

  // Concentric depth rings for 1-point
  const onePointRings = [
    80, 160, 260, 400, 600, 900, 1350, 2000, 3000, 4500, 6800, 10000, 15000, 25000,
  ]

  // 2-Point Perspective: two vanishing points on horizon
  const twoPointLines = useMemo(() => {
    if (gridType !== GridType.TwoPoint) return null
    const vpLeft = -1800
    const vpRight = 1800
    const leftRays: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    const rightRays: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

    for (let deg = -75; deg <= 75; deg += 4) {
      const rad = (deg * Math.PI) / 180
      leftRays.push({
        x1: vpLeft,
        y1: 0,
        x2: vpLeft + Math.cos(rad) * R,
        y2: Math.sin(rad) * R,
      })
    }

    for (let deg = 105; deg <= 255; deg += 4) {
      const rad = (deg * Math.PI) / 180
      rightRays.push({
        x1: vpRight,
        y1: 0,
        x2: vpRight + Math.cos(rad) * R,
        y2: Math.sin(rad) * R,
      })
    }

    const verticalLines: number[] = []
    for (let x = -1400; x <= 1400; x += 100) {
      verticalLines.push(x)
    }

    return { vpLeft, vpRight, leftRays, rightRays, verticalLines }
  }, [gridType])

  // 3-Point Perspective: left, right, and nadir (bottom)
  const threePointLines = useMemo(() => {
    if (gridType !== GridType.ThreePoint) return null
    const vpLeft = -2200
    const vpRight = 2200
    const vpBottom = 2600

    const leftRays: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    const rightRays: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    const bottomRays: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

    for (let deg = -70; deg <= 70; deg += 5) {
      const rad = (deg * Math.PI) / 180
      leftRays.push({
        x1: vpLeft,
        y1: 0,
        x2: vpLeft + Math.cos(rad) * R,
        y2: Math.sin(rad) * R,
      })
    }

    for (let deg = 110; deg <= 250; deg += 5) {
      const rad = (deg * Math.PI) / 180
      rightRays.push({
        x1: vpRight,
        y1: 0,
        x2: vpRight + Math.cos(rad) * R,
        y2: Math.sin(rad) * R,
      })
    }

    for (let deg = -160; deg <= -20; deg += 5) {
      const rad = (deg * Math.PI) / 180
      bottomRays.push({
        x1: 0,
        y1: vpBottom,
        x2: Math.cos(rad) * R,
        y2: vpBottom + Math.sin(rad) * R,
      })
    }

    return { vpLeft, vpRight, vpBottom, leftRays, rightRays, bottomRays }
  }, [gridType])

  if (gridType === GridType.None) {
    return null
  }

  // Render non-repeating perspective grids directly
  if (gridType === GridType.OnePoint) {
    return (
      <g opacity={0.8}>
        {/* Horizon line */}
        <line x1={-R} y1={0} x2={R} y2={0} stroke={strokeColor} strokeWidth={horizonStrokeWidth} />
        {/* Center vertical */}
        <line x1={0} y1={-R} x2={0} y2={R} stroke={strokeColor} strokeWidth={strokeWidth} />
        {/* Radiating perspective rays from center */}
        {onePointRays.map((ray, i) => (
          <line key={i} x1={0} y1={0} x2={ray.x2} y2={ray.y2} stroke={strokeColor} strokeWidth={strokeWidth} />
        ))}
        {/* Concentric perspective depth boxes */}
        {onePointRings.map((r, i) => (
          <rect
            key={i}
            x={-r}
            y={-r * 0.75}
            width={r * 2}
            height={r * 1.5}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={0.6}
          />
        ))}
        {/* Center vanishing point marker */}
        <circle cx={0} cy={0} r={4 / camera.zoom} fill={strokeColor} />
      </g>
    )
  }

  if (gridType === GridType.TwoPoint && twoPointLines) {
    return (
      <g opacity={0.8}>
        {/* Horizon */}
        <line x1={-R} y1={0} x2={R} y2={0} stroke={strokeColor} strokeWidth={horizonStrokeWidth} />
        {/* Left VP Rays */}
        {twoPointLines.leftRays.map((ray, i) => (
          <line key={`l-${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} stroke={strokeColor} strokeWidth={strokeWidth} />
        ))}
        {/* Right VP Rays */}
        {twoPointLines.rightRays.map((ray, i) => (
          <line key={`r-${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} stroke={strokeColor} strokeWidth={strokeWidth} />
        ))}
        {/* Center vertical lines */}
        {twoPointLines.verticalLines.map((x, i) => (
          <line key={`v-${i}`} x1={x} y1={-R} x2={x} y2={R} stroke={strokeColor} strokeWidth={strokeWidth} opacity={0.4} />
        ))}
        {/* VP Markers */}
        <circle cx={twoPointLines.vpLeft} cy={0} r={5 / camera.zoom} fill={strokeColor} />
        <circle cx={twoPointLines.vpRight} cy={0} r={5 / camera.zoom} fill={strokeColor} />
      </g>
    )
  }

  if (gridType === GridType.ThreePoint && threePointLines) {
    return (
      <g opacity={0.8}>
        {/* Horizon */}
        <line x1={-R} y1={0} x2={R} y2={0} stroke={strokeColor} strokeWidth={horizonStrokeWidth} />
        {/* Left VP Rays */}
        {threePointLines.leftRays.map((ray, i) => (
          <line key={`l-${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} stroke={strokeColor} strokeWidth={strokeWidth} />
        ))}
        {/* Right VP Rays */}
        {threePointLines.rightRays.map((ray, i) => (
          <line key={`r-${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} stroke={strokeColor} strokeWidth={strokeWidth} />
        ))}
        {/* Bottom VP Rays */}
        {threePointLines.bottomRays.map((ray, i) => (
          <line key={`b-${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} stroke={strokeColor} strokeWidth={strokeWidth} />
        ))}
        {/* VP Markers */}
        <circle cx={threePointLines.vpLeft} cy={0} r={5 / camera.zoom} fill={strokeColor} />
        <circle cx={threePointLines.vpRight} cy={0} r={5 / camera.zoom} fill={strokeColor} />
        <circle cx={0} cy={threePointLines.vpBottom} r={5 / camera.zoom} fill={strokeColor} />
      </g>
    )
  }

  // Repeating tile patterns for dot, graph, lined, isometric, triangle
  return (
    <>
      <defs>
        {/* 1. Dot Grid */}
        {gridType === GridType.Dot && (
          <pattern id="grid-pattern-dot" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <circle cx={gridSize / 2} cy={gridSize / 2} r={1.5 / camera.zoom} fill={strokeColor} />
            <circle cx={0} cy={0} r={1.5 / camera.zoom} fill={strokeColor} />
            <circle cx={gridSize} cy={0} r={1.5 / camera.zoom} fill={strokeColor} />
            <circle cx={0} cy={gridSize} r={1.5 / camera.zoom} fill={strokeColor} />
            <circle cx={gridSize} cy={gridSize} r={1.5 / camera.zoom} fill={strokeColor} />
          </pattern>
        )}

        {/* 2. Graph Paper */}
        {gridType === GridType.Graph && (
          <pattern id="grid-pattern-graph" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          </pattern>
        )}

        {/* 3. Lined Paper Horizontal */}
        {gridType === GridType.LinedHorizontal && (
          <pattern id="grid-pattern-lined-h" width={gridSize} height={gridSize / 2} patternUnits="userSpaceOnUse">
            <line
              x1="0"
              y1={gridSize / 2}
              x2={gridSize}
              y2={gridSize / 2}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          </pattern>
        )}

        {/* 4. Lined Paper Vertical */}
        {gridType === GridType.LinedVertical && (
          <pattern id="grid-pattern-lined-v" width={gridSize / 2} height={gridSize} patternUnits="userSpaceOnUse">
            <line
              x1={gridSize / 2}
              y1="0"
              x2={gridSize / 2}
              y2={gridSize}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          </pattern>
        )}

        {/* 5. Isometric Grid */}
        {gridType === GridType.Isometric && (
          <pattern
            id="grid-pattern-isometric"
            width={gridSize}
            height={gridSize * Math.sqrt(3)}
            patternUnits="userSpaceOnUse"
          >
            {(() => {
              const h = gridSize * Math.sqrt(3)
              const halfH = h / 2
              return (
                <path
                  d={`
                    M 0 0 L ${gridSize} ${halfH} L 0 ${h}
                    M ${gridSize} 0 L 0 ${halfH} L ${gridSize} ${h}
                    M 0 0 L 0 ${h}
                    M ${gridSize} 0 L ${gridSize} ${h}
                  `}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
              )
            })()}
          </pattern>
        )}

        {/* 6. Triangle Grid */}
        {gridType === GridType.Triangle && (
          <pattern
            id="grid-pattern-triangle"
            width={gridSize}
            height={(gridSize * Math.sqrt(3)) / 2}
            patternUnits="userSpaceOnUse"
          >
            {(() => {
              const h = (gridSize * Math.sqrt(3)) / 2
              return (
                <path
                  d={`
                    M 0 0 L ${gridSize} 0
                    M 0 0 L ${gridSize / 2} ${h} L ${gridSize} 0
                    M 0 ${h} L ${gridSize} ${h}
                  `}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />
              )
            })()}
          </pattern>
        )}
      </defs>

      <rect
        x="-500000"
        y="-500000"
        width="1000000"
        height="1000000"
        fill={`url(#${
          gridType === GridType.Dot
            ? "grid-pattern-dot"
            : gridType === GridType.Graph
            ? "grid-pattern-graph"
            : gridType === GridType.LinedHorizontal
            ? "grid-pattern-lined-h"
            : gridType === GridType.LinedVertical
            ? "grid-pattern-lined-v"
            : gridType === GridType.Isometric
            ? "grid-pattern-isometric"
            : "grid-pattern-triangle"
        })`}
      />
    </>
  )
}
