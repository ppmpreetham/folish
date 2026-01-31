import { useRef, useState, useEffect, useCallback } from "react"
import { COLOR_WHEEL_IDS, COPIC_COLORS } from "../../utils/colors"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { useCanvasStore } from "../../stores/canvasStore"

const SIZE = 700
const DPR = Math.min(window.devicePixelRatio || 1, 2)
const SECTIONS = 69
const CENTER_RADIUS = 50
const FRICTION = 0.95

interface SwatchData {
  color: string
  code: string
  path: Path2D
  swatchCenterX: number
  swatchCenterY: number
  element: { scale: number; alpha: number; hoverScale: number }
}

const ColorPicker = ({ onChange }: { onChange?: (hex: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitTestCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const swatchesRef = useRef<SwatchData[]>([])
  const centerPathRef = useRef<Path2D>(new Path2D())

  const [isOpen, setIsOpen] = useState(false)

  const activeColor = useCanvasStore((state) => state.ui.activeColor)
  const setActiveColor = useCanvasStore((state) => state.setActiveColor)

  const rotationRef = useRef(0)
  const velocityRef = useRef(0)
  const isDraggingRef = useRef(false)
  const isTouchRef = useRef(false)
  const lastMouseAngleRef = useRef(0)
  const rafRef = useRef<number>(0)

  const { contextSafe } = useGSAP()

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    const globalRotation = rotationRef.current

    ctx.save()
    ctx.translate(SIZE / 2, SIZE / 2)
    ctx.rotate(globalRotation)
    ctx.translate(-SIZE / 2, -SIZE / 2)

    swatchesRef.current.forEach((swatch) => {
      if (swatch.element.alpha <= 0) return

      ctx.save()
      ctx.globalAlpha = swatch.element.alpha
      const combinedScale = swatch.element.scale * swatch.element.hoverScale

      ctx.translate(swatch.swatchCenterX, swatch.swatchCenterY)
      ctx.scale(combinedScale, combinedScale)
      ctx.translate(-swatch.swatchCenterX, -swatch.swatchCenterY)

      ctx.fillStyle = swatch.color
      ctx.fill(swatch.path)

      if (swatch.color.toLowerCase() === activeColor?.toLowerCase()) {
        ctx.strokeStyle = "black"
        ctx.lineWidth = 2
        ctx.stroke(swatch.path)
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"
        ctx.lineWidth = 1
        ctx.stroke(swatch.path)
      }
      ctx.restore()
    })
    ctx.restore()

    ctx.save()
    ctx.fillStyle = "#1a1a1a"
    ctx.fill(centerPathRef.current)
    ctx.strokeStyle = "#444"
    ctx.lineWidth = 2
    ctx.stroke(centerPathRef.current)
    ctx.fillStyle = "white"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = "bold 12px sans-serif"
    ctx.fillText(isOpen ? "CLOSE" : "COLORS", SIZE / 2, SIZE / 2)
    ctx.restore()
  }, [isOpen, activeColor])

  const updateInertia = useCallback(() => {
    if (!isDraggingRef.current && Math.abs(velocityRef.current) > 0.001) {
      rotationRef.current += velocityRef.current
      velocityRef.current *= FRICTION
      redrawCanvas()
      rafRef.current = requestAnimationFrame(updateInertia)
    } else {
      velocityRef.current = 0
    }
  }, [redrawCanvas])

  const getMouseAngle = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return Math.atan2(
      clientY - (rect.top + rect.height / 2),
      clientX - (rect.left + rect.width / 2),
    )
  }

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * SIZE
    const y = ((clientY - rect.top) / rect.height) * SIZE
    const dx = x - SIZE / 2
    const dy = y - SIZE / 2
    const cos = Math.cos(-rotationRef.current)
    const sin = Math.sin(-rotationRef.current)
    return { x: SIZE / 2 + (dx * cos - dy * sin), y: SIZE / 2 + (dx * sin + dy * cos) }
  }

  const handleCenterClick = () => {
    if (!isOpen) {
      setIsOpen(true)
      toggleWheel(true)
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isOpen) return

    const { x, y } = getCanvasCoords(e.clientX, e.clientY)
    isTouchRef.current = e.pointerType === "touch"

    if (hitTestCtxRef.current!.isPointInPath(centerPathRef.current, x, y)) {
      setIsOpen(false)
      toggleWheel(false)
      return
    }

    const clickedSwatch = swatchesRef.current.find((s) =>
      hitTestCtxRef.current!.isPointInPath(s.path, x, y),
    )
    if (clickedSwatch) {
      setActiveColor(clickedSwatch.color)
      if (onChange) onChange(clickedSwatch.color)
      return
    }

    isDraggingRef.current = true
    velocityRef.current = 0
    cancelAnimationFrame(rafRef.current)
    lastMouseAngleRef.current = getMouseAngle(e.clientX, e.clientY)
  }

  const handlePointerMove = contextSafe((e: React.PointerEvent) => {
    if (!isOpen) return
    if (isDraggingRef.current) {
      const currentAngle = getMouseAngle(e.clientX, e.clientY)
      const delta = currentAngle - lastMouseAngleRef.current
      rotationRef.current += delta

      if (isTouchRef.current) {
        velocityRef.current = delta
      }

      lastMouseAngleRef.current = currentAngle
      redrawCanvas()
      return
    }

    const { x, y } = getCanvasCoords(e.clientX, e.clientY)
    swatchesRef.current.forEach((s) => {
      const isHovered = hitTestCtxRef.current!.isPointInPath(s.path, x, y)
      const target = isHovered ? 1.15 : 1
      if (s.element.hoverScale !== target) {
        gsap.to(s.element, {
          hoverScale: target,
          duration: 0.2,
          overwrite: "auto",
          onUpdate: redrawCanvas,
        })
      }
    })
  })

  const handlePointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      if (isTouchRef.current && Math.abs(velocityRef.current) > 0.001) {
        rafRef.current = requestAnimationFrame(updateInertia)
      }
    }
  }

  const handleWheel = (e: WheelEvent) => {
    if (!isOpen) return
    e.preventDefault()
    rotationRef.current += e.deltaY * 0.002
    redrawCanvas()
  }

  const toggleWheel = contextSafe((open: boolean) => {
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
    )
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) canvas.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      canvas?.removeEventListener("wheel", handleWheel)
      cancelAnimationFrame(rafRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (isOpen && canvasRef.current && !canvasRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        toggleWheel(false)
      }
    }
    window.addEventListener("mousedown", handleOutside)
    return () => window.removeEventListener("mousedown", handleOutside)
  }, [isOpen])

  useEffect(() => {
    redrawCanvas()
  }, [activeColor, redrawCanvas])

  useGSAP(() => {
    const hitCanvas = document.createElement("canvas")
    hitCanvas.width = SIZE
    hitCanvas.height = SIZE
    hitTestCtxRef.current = hitCanvas.getContext("2d")

    const canvas = canvasRef.current!
    canvas.width = SIZE * DPR
    canvas.height = SIZE * DPR
    canvas.style.width = canvas.style.height = `${SIZE}px`
    const ctx = canvas.getContext("2d")!
    ctx.scale(DPR, DPR)

    const cx = SIZE / 2
    const cy = SIZE / 2
    const innerRadius = 120
    const sectionWidth = (SIZE / 2 - innerRadius) / COLOR_WHEEL_IDS.length
    const angleStep = (Math.PI * 2) / SECTIONS

    centerPathRef.current = new Path2D()
    centerPathRef.current.arc(cx, cy, CENTER_RADIUS, 0, Math.PI * 2)

    const newSwatches: SwatchData[] = []
    COLOR_WHEEL_IDS.forEach((circle, circleIdx) => {
      const rIn = innerRadius + circleIdx * sectionWidth
      const rOut = rIn + sectionWidth
      circle.forEach((id, sIdx) => {
        const hex = COPIC_COLORS[id as keyof typeof COPIC_COLORS]
        if (!hex) return
        const aStart = sIdx * angleStep - Math.PI / 2
        const aEnd = aStart + angleStep
        const path = new Path2D()
        path.arc(cx, cy, rIn, aStart, aEnd)
        path.arc(cx, cy, rOut, aEnd, aStart, true)
        path.closePath()
        newSwatches.push({
          color: hex,
          code: id,
          path,
          swatchCenterX: cx + Math.cos((aStart + aEnd) / 2) * ((rIn + rOut) / 2),
          swatchCenterY: cy + Math.sin((aStart + aEnd) / 2) * ((rIn + rOut) / 2),
          element: { scale: 0, alpha: 0, hoverScale: 1 },
        })
      })
    })
    swatchesRef.current = newSwatches
    redrawCanvas()
  }, [])

  return (
    <div
      className="fixed top-0 left-0 z-50 pointer-events-none"
      style={{ width: SIZE, height: SIZE, transform: "translate(-50%, -50%)" }}
    >
      {!isOpen && (
        <div
          className="absolute top-1/2 left-1/2 cursor-pointer pointer-events-auto"
          style={{
            width: CENTER_RADIUS * 2,
            height: CENTER_RADIUS * 2,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
          }}
          onClick={handleCenterClick}
        />
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="touch-none select-none absolute top-1/2 left-1/2 bg-transparent"
        style={{
          width: SIZE,
          height: SIZE,
          transform: "translate(-50%, -50%)",
          pointerEvents: isOpen ? "auto" : "none",
          cursor: isOpen ? "grab" : "default",
        }}
      />
    </div>
  )
}

export default ColorPicker
