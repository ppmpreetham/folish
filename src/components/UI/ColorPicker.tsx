import { useRef } from "react"
import { COLOR_WHEEL_IDS, COPIC_COLORS } from "../../utils/colors"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

const SIZE = 700
const DPR = Math.min(window.devicePixelRatio || 1, 2)
const SECTIONS = 69

interface SwatchData {
  color: string
  code: string
  path: Path2D
  cx: number
  cy: number
  radiusInner: number
  radiusOuter: number
  angleStart: number
  angleEnd: number
  swatchCenterX: number
  swatchCenterY: number
  element: { scale: number; alpha: number }
}

const ColorPicker = ({ onChange }: { onChange?: (hex: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const swatchesRef = useRef<SwatchData[]>([])

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    swatchesRef.current.forEach((swatch) => {
      ctx.save()
      ctx.globalAlpha = swatch.element.alpha
      ctx.translate(swatch.swatchCenterX, swatch.swatchCenterY)
      ctx.scale(swatch.element.scale, swatch.element.scale)
      ctx.translate(-swatch.swatchCenterX, -swatch.swatchCenterY)
      ctx.fillStyle = swatch.color
      ctx.fill(swatch.path)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
      ctx.lineWidth = 0.5
      ctx.stroke(swatch.path)
      ctx.restore()
    })
  }

  useGSAP(() => {
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

    const newSwatches: SwatchData[] = []

    COLOR_WHEEL_IDS.forEach((circle, circleIdx) => {
      const radiusInner = innerRadius + circleIdx * sectionWidth
      const radiusOuter = radiusInner + sectionWidth

      circle.forEach((id, sectionIdx) => {
        const hex = COPIC_COLORS[id as keyof typeof COPIC_COLORS]
        if (!hex) return

        const angleStart = sectionIdx * angleStep - Math.PI / 2
        const angleEnd = angleStart + angleStep
        const angleMid = (angleStart + angleEnd) / 2
        const radiusMid = (radiusInner + radiusOuter) / 2

        const path = new Path2D()
        path.arc(cx, cy, radiusInner, angleStart, angleEnd)
        path.arc(cx, cy, radiusOuter, angleEnd, angleStart, true)
        path.closePath()

        newSwatches.push({
          color: hex,
          code: id,
          path,
          cx,
          cy,
          radiusInner,
          radiusOuter,
          angleStart,
          angleEnd,
          swatchCenterX: cx + Math.cos(angleMid) * radiusMid,
          swatchCenterY: cy + Math.sin(angleMid) * radiusMid,
          element: { scale: 0, alpha: 0 },
        })
      })
    })

    swatchesRef.current = newSwatches

    const tl = gsap.timeline({ onUpdate: redrawCanvas })

    swatchesRef.current.forEach((swatch) => {
      const normalizedAngle = (swatch.angleStart + Math.PI / 2) / (Math.PI * 2)
      tl.to(
        swatch.element,
        {
          scale: 1,
          alpha: 1,
          duration: 0.2,
          ease: "back.out(1.7)",
        },
        normalizedAngle * 0.5,
      )
    })
  }, [])

  function handleClick(e: React.PointerEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const ctx = canvas.getContext("2d")!

    for (const swatch of swatchesRef.current) {
      if (ctx.isPointInPath(swatch.path, x, y)) {
        onChange?.(swatch.color)
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
