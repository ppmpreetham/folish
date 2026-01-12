import { type FC } from "react"
import { Camera } from "../../types"

export const Grid: FC<{ camera: Camera }> = ({ camera }) => {
  const gridSize = 100
  // Use the camera zoom to scale the grid stroke so it stays thin
  const strokeWidth = 0.5 / camera.zoom

  return (
    <>
      <defs>
        <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={strokeWidth}
          />
        </pattern>
      </defs>
      {/* Massive bounds to simulate infinity */}
      <rect x="-500000" y="-500000" width="1000000" height="1000000" fill="url(#grid)" />
    </>
  )
}
