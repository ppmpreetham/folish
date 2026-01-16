import { useEffect, useRef } from "react"
import { COLOR_WHEEL_IDS, COPIC_COLORS } from "../../utils/colors"

const SIZE = 700
const DPR = Math.min(window.devicePixelRatio || 1, 2)
const SECTIONS = 69

const ColorPicker = ({ onChange }: { onChange?: (hex: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const swatchesRef = useRef<
    Array<{
      color: string
      code: string
      path: Path2D
    }>
  >([])

  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = SIZE * DPR
    canvas.height = SIZE * DPR
    canvas.style.width = canvas.style.height = `${SIZE}px`

    const ctx = canvas.getContext("2d")!
    ctx.scale(DPR, DPR)

    const cx = SIZE / 2
    const cy = SIZE / 2
    const innerRadius = 250
    const sectionWidth = (SIZE / 2 - innerRadius) / COLOR_WHEEL_IDS.length
    const angleStep = (Math.PI * 2) / SECTIONS

    swatchesRef.current = []

    COLOR_WHEEL_IDS.forEach((circle, circleIdx) => {
      const radiusInner = innerRadius + circleIdx * sectionWidth
      const radiusOuter = radiusInner + sectionWidth

      circle.forEach((id, sectionIdx) => {
        const hex = COPIC_COLORS[id as keyof typeof COPIC_COLORS]
        if (!hex) return

        const angleStart = sectionIdx * angleStep - Math.PI / 2
        const angleEnd = angleStart + angleStep

        const path = new Path2D()
        path.moveTo(
          cx + Math.cos(angleStart) * radiusInner,
          cy + Math.sin(angleStart) * radiusInner
        )
        path.arc(cx, cy, radiusInner, angleStart, angleEnd)
        path.lineTo(cx + Math.cos(angleEnd) * radiusOuter, cy + Math.sin(angleEnd) * radiusOuter)
        path.arc(cx, cy, radiusOuter, angleEnd, angleStart, true)
        path.closePath()

        ctx.fillStyle = hex
        ctx.fill(path)

        if (hex && hex !== "") {
          ctx.fillStyle = hex
          ctx.fill(path)
        } else {
          ctx.fillStyle = "transparent"
          ctx.fill(path)
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
        ctx.lineWidth = 0.5
        ctx.stroke(path)

        swatchesRef.current.push({
          color: hex,
          code: id,
          path,
        })
      })
    })
  }, [])

  function handleClick(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * DPR
    const y = (e.clientY - rect.top) * DPR
    const ctx = canvas.getContext("2d")!

    for (const swatch of swatchesRef.current) {
      if (ctx.isPointInPath(swatch.path, x, y)) {
        onChange?.(swatch.color)
        console.log(`Selected ${swatch.code}: ${swatch.color}`)
        break
      }
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="touch-none select-none cursor-pointer rounded-full shadow-lg"
      onPointerDown={handleClick}
    />
  )
}

export default ColorPicker
