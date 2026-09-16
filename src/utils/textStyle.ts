import type { FontFamilyId } from "../types"

export const FONT_STACKS: Record<FontFamilyId, string> = {
  draw: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
  sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Cascadia Code', 'Cascadia Mono', 'SF Mono', Consolas, 'Courier New', monospace",
}

export const getFontStack = (family?: FontFamilyId) => FONT_STACKS[family ?? "draw"]

export const TEXT_LINE_HEIGHT = 1.25

export const TEXT_FONT_SIZES = [14, 18, 24, 32, 48]

export const DEFAULT_TEXT_FONT_SIZE = 24

export const getLineHeight = (fontSize: number) => Math.round(fontSize * TEXT_LINE_HEIGHT)
