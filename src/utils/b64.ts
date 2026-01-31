// this code was inspired from tldraw's b64 compression implementation

import { Point } from "../types"

declare global {
  interface Uint8Array {
    toBase64?(): string
  }
  interface Uint8ArrayConstructor {
    fromBase64?(base64: string): Uint8Array
  }
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const B64_LOOKUP = new Uint8Array(128)
for (let i = 0; i < 64; i++) {
  B64_LOOKUP[BASE64_CHARS.charCodeAt(i)] = i
}

export function numberToFloat16Bits(value: number): number {
  const float32 = new Float32Array(1)
  const uint32 = new Uint32Array(float32.buffer)
  float32[0] = value

  const bits = uint32[0]
  const sign = (bits >> 31) & 0x1
  const exp = (bits >> 23) & 0xff
  const frac = bits & 0x7fffff

  if (exp === 0xff) {
    return (sign << 15) | 0x7c00 | (frac ? 0x200 : 0)
  }

  if (exp === 0 && frac === 0) {
    return sign << 15
  }

  let newExp = exp - 127 + 15

  if (newExp >= 31) {
    return (sign << 15) | 0x7c00
  }

  if (newExp <= 0) {
    if (newExp < -10) {
      return sign << 15
    }
    const newFrac = (frac | 0x800000) >> (1 - newExp)
    return (sign << 15) | (newFrac >> 13)
  }

  return (sign << 15) | (newExp << 10) | (frac >> 13)
}

export function float16BitsToNumber(bits: number): number {
  const sign = (bits >> 15) & 0x1
  const exp = (bits >> 10) & 0x1f
  const frac = bits & 0x3ff

  if (exp === 0) {
    return (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024)
  }

  if (exp === 31) {
    return frac ? NaN : sign ? -Infinity : Infinity
  }

  return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024)
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof bytes.toBase64 === "function") {
    return bytes.toBase64()
  }

  let result = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i]
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0

    result += BASE64_CHARS[(byte1 >> 2) & 0x3f]
    result += BASE64_CHARS[((byte1 & 0x3) << 4) | ((byte2 >> 4) & 0xf)]
    result += BASE64_CHARS[((byte2 & 0xf) << 2) | ((byte3 >> 6) & 0x3)]
    result += BASE64_CHARS[byte3 & 0x3f]
  }

  return result
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Uint8Array.fromBase64 === "function") {
    return Uint8Array.fromBase64(base64)
  }

  const numBytes = Math.floor((base64.length * 3) / 4)
  const bytes = new Uint8Array(numBytes)
  let byteIndex = 0

  for (let i = 0; i < base64.length; i += 4) {
    const c0 = B64_LOOKUP[base64.charCodeAt(i)]
    const c1 = B64_LOOKUP[base64.charCodeAt(i + 1)]
    const c2 = B64_LOOKUP[base64.charCodeAt(i + 2)]
    const c3 = B64_LOOKUP[base64.charCodeAt(i + 3)]

    bytes[byteIndex++] = (c0 << 2) | (c1 >> 4)
    if (byteIndex < numBytes) bytes[byteIndex++] = ((c1 & 0xf) << 4) | (c2 >> 2)
    if (byteIndex < numBytes) bytes[byteIndex++] = ((c2 & 0x3) << 6) | c3
  }

  return bytes
}

export function encodePoints(points: Point[]): string {
  if (points.length === 0) return ""

  const buffer = new Uint8Array(12 + (points.length - 1) * 6)
  const dataView = new DataView(buffer.buffer)

  const first = points[0]
  dataView.setFloat32(0, first.x, true)
  dataView.setFloat32(4, first.y, true)
  dataView.setFloat32(8, first.pressure, true)

  let prevX = first.x
  let prevY = first.y
  let prevZ = first.pressure

  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    const offset = 12 + (i - 1) * 6

    const dx = p.x - prevX
    const dy = p.y - prevY
    const dz = p.pressure - prevZ

    dataView.setUint16(offset, numberToFloat16Bits(dx), true)
    dataView.setUint16(offset + 2, numberToFloat16Bits(dy), true)
    dataView.setUint16(offset + 4, numberToFloat16Bits(dz), true)

    prevX = p.x
    prevY = p.y
    prevZ = p.pressure
  }

  return uint8ArrayToBase64(buffer)
}

export function decodePoints(base64: string): Point[] {
  if (!base64) return []

  const bytes = base64ToUint8Array(base64)
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  if (bytes.length < 12) return []

  const result: Point[] = []

  let x = dataView.getFloat32(0, true)
  let y = dataView.getFloat32(4, true)
  let z = dataView.getFloat32(8, true)

  result.push({ x, y, pressure: z })

  for (let offset = 12; offset < bytes.length; offset += 6) {
    const dx = float16BitsToNumber(dataView.getUint16(offset, true))
    const dy = float16BitsToNumber(dataView.getUint16(offset + 2, true))
    const dz = float16BitsToNumber(dataView.getUint16(offset + 4, true))

    x += dx
    y += dy
    z += dz

    result.push({ x, y, pressure: z })
  }

  return result
}
