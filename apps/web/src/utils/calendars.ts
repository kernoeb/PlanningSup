/**
 * Reusable calendars builder for ScheduleX with contrast-aware onContainer colors.
 *
 * Usage:
 * import { buildCalendars } from '@web/utils/calendars'
 * const calendars = buildCalendars({
 *   lecture: '#efd6d8',
 *   lab: '#bbe0ff',
 *   tutorial: '#d4fbcc',
 *   other: '#EDDD6E',
 * })
 *
 * // With overrides (e.g., custom "no-teacher" color or forcing text color):
 * const calendars = buildCalendars(colors, {
 *   noTeacherColor: '#676767',
 *   onContainerStrategy: 'auto', // 'auto' | 'black' | 'white'
 * })
 */

export type EventKind = 'lecture' | 'lab' | 'tutorial' | 'other'
export type ColorMap = Record<EventKind, string>

export interface CalendarPaletteColors {
  main: string
  container: string
  onContainer: string
}

export interface CalendarTypeLike {
  colorName: string
  lightColors: CalendarPaletteColors
  darkColors: CalendarPaletteColors
}

export type CalendarsMap = Record<string, CalendarTypeLike>

export interface BuildCalendarsOptions {
  /**
   * Color used for events categorized as "no-teacher"
   * Default: '#676767'
   */
  noTeacherColor?: string
  /**
   * Strategy for choosing onContainer (text) color.
   * - 'auto' (default): choose black or white based on WCAG luminance threshold.
   * - 'black': always use black text.
   * - 'white': always use white text.
   */
  onContainerStrategy?: 'auto' | 'black' | 'white'
}

/**
 * Normalize a hex color to 7-char form: #RRGGBB
 * - Accepts #RGB or #RRGGBB
 * - Returns null if invalid
 */
export function normalizeHex(hex: string): string | null {
  if (!hex || typeof hex !== 'string') return null
  let h = hex.trim().toLowerCase()
  if (!h.startsWith('#')) h = `#${h}`
  if (h.length === 4 && /^#[0-9a-f]{3}$/i.test(h)) {
    const r = h[1]
    const g = h[2]
    const b = h[3]
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  if (h.length === 7 && /^#[0-9a-f]{6}$/i.test(h)) {
    return h.toUpperCase()
  }
  return null
}

function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  const n = normalizeHex(hex)
  if (!n) return null
  const r = Number.parseInt(n.slice(1, 3), 16)
  const g = Number.parseInt(n.slice(3, 5), 16)
  const b = Number.parseInt(n.slice(5, 7), 16)
  return { r, g, b }
}

/**
 * Convert sRGB channel (0-255) to linearized value for luminance calc
 */
function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * WCAG relative luminance
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Choose black or white text color for a given background based on WCAG luminance threshold.
 * - If L > 0.179 => black text, else white text.
 */
export function getContrastTextColor(bgHex: string): '#000000' | '#FFFFFF' {
  const L = relativeLuminance(bgHex)
  if (L == null) return '#000000'
  return L > 0.179 ? '#000000' : '#FFFFFF'
}

function resolveOnContainer(bg: string, strategy: BuildCalendarsOptions['onContainerStrategy']): '#000000' | '#FFFFFF' {
  switch (strategy) {
    case 'black': return '#000000'
    case 'white': return '#FFFFFF'
    case 'auto':
    default:
      return getContrastTextColor(bg)
  }
}

function makePalette(name: string, color: string, onContainer: '#000000' | '#FFFFFF'): CalendarTypeLike {
  // For now main=container=color for both light and dark modes.
  return {
    colorName: name,
    lightColors: { main: color, container: color, onContainer },
    darkColors: { main: color, container: color, onContainer },
  }
}

/**
 * Build the calendars map used by ScheduleX for color palettes.
 * - Includes 'lecture' | 'lab' | 'tutorial' | 'other' from provided colors
 * - Includes 'no-teacher' with a default or custom color
 * - Computes onContainer per color based on the chosen strategy (default: 'auto')
 */
export function buildCalendars(colors: ColorMap, options?: BuildCalendarsOptions): CalendarsMap {
  const {
    noTeacherColor = '#676767',
    onContainerStrategy = 'auto',
  } = options || {}

  const lecture = normalizeHex(colors.lecture) ?? '#EFD6D8'
  const lab = normalizeHex(colors.lab) ?? '#BBE0FF'
  const tutorial = normalizeHex(colors.tutorial) ?? '#D4FBCC'
  const other = normalizeHex(colors.other) ?? '#EDDD6E'
  const noTeacher = normalizeHex(noTeacherColor) ?? '#676767'

  const onLecture = resolveOnContainer(lecture, onContainerStrategy)
  const onLab = resolveOnContainer(lab, onContainerStrategy)
  const onTutorial = resolveOnContainer(tutorial, onContainerStrategy)
  const onOther = resolveOnContainer(other, onContainerStrategy)
  const onNoTeacher = resolveOnContainer(noTeacher, onContainerStrategy)

  return {
    'lecture': makePalette('lecture', lecture, onLecture),
    'lab': makePalette('lab', lab, onLab),
    'tutorial': makePalette('tutorial', tutorial, onTutorial),
    'other': makePalette('other', other, onOther),
    'no-teacher': makePalette('no-teacher', noTeacher, onNoTeacher),
  }
}

export default buildCalendars
