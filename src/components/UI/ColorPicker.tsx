import { useEffect, useRef } from "react"
import { COPIC_COLORS } from "../../utils/colors"

const SIZE = 700
const DPR = Math.min(window.devicePixelRatio || 1, 2)
const SECTIONS = 69

const COLOR_WHEEL_IDS: string[][] = [
  [
    "BG23",
    "BG18",
    "BG09",
    "G99",
    "G85",
    "G46",
    "G29",
    "G18",
    "G09",
    "YG99",
    "YG67",
    "YG45",
    "YG25",
    "YG17",
    "Y38",
    "Y28",
    "Y08",
    "E99",
    "E89",
    "E79",
    "E59",
    "E49",
    "E39",
    "E29",
    "E19",
    "E09",
    "YR82",
    "YR68",
    "YR31",
    "YR27",
    "YR18",
    "YR09",
    "R89",
    "R59",
    "R46",
    "R39",
    "R29",
    "R17",
    "R08",
    "RV99",
    "RV69",
    "RV55",
    "RV42",
    "RV34",
    "RV29",
    "RV19",
    "RV09",
    "V99",
    "V28",
    "V17",
    "V07",
    "BV34",
    "BV29",
    "BV17",
    "BV08",
    "B99",
    "B79",
    "B69",
    "B52",
    "B45",
    "B39",
    "B29",
    "B18",
    "B05",
    "BG99",
    "BG78",
    "BG57",
    "BG49",
    "BG34",
  ],
  ["BV000"],
  [],
]

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
    const innerRadius = 100
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
