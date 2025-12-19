import * as z from 'zod'

export const planningsInput = z.array(z.string()).optional().transform((arr) => {
  if (!arr) return []
  const norm = Array.from(new Set(
    arr
      .map(s => (typeof s === 'string' ? s.trim() : ''))
      .filter(s => s.length > 0 && s.length <= 255),
  ))
  return norm.slice(0, 100)
})

export const customGroupsInput = z.string().optional().transform((val) => {
  const normalizePlannings = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const item of raw) {
      if (typeof item !== 'string') continue
      const trimmed = item.trim()
      if (!trimmed) continue
      if (trimmed.length > 255) continue
      if (!seen.has(trimmed)) {
        seen.add(trimmed)
        out.push(trimmed)
        if (out.length >= 100) break
      }
    }
    return out
  }

  const normalizeGroups = (raw: unknown) => {
    if (!Array.isArray(raw)) return []
    const isUuid = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    const out: Array<{ id: string, name: string, plannings: string[] }> = []
    const seenIds = new Set<string>()
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const id = typeof obj.id === 'string' ? obj.id.trim() : ''
      const name = typeof obj.name === 'string' ? obj.name.trim() : ''
      if (!id || !isUuid(id)) continue
      if (!name || name.length > 80) continue
      if (seenIds.has(id)) continue
      seenIds.add(id)
      out.push({
        id,
        name,
        plannings: normalizePlannings(obj.plannings),
      })
      if (out.length >= 50) break
    }
    return out
  }

  try {
    return JSON.stringify(normalizeGroups(JSON.parse(val || '[]')))
  } catch {
    return '[]'
  }
})

export const colorsInput = z.string().optional().transform((val) => {
  try {
    const parsed = JSON.parse(val || '{}')
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          return '{}'
        }
      }
      return JSON.stringify(parsed)
    }
    return '{}'
  } catch {
    return '{}'
  }
})

export const prefsMetaInput = z.string().optional().transform((val) => {
  try {
    const allowed = ['theme', 'highlightTeacher', 'showWeekends', 'mergeDuplicates', 'blocklist', 'colors', 'plannings', 'customGroups'] as const
    const set = new Set<string>(allowed as unknown as string[])
    const raw = JSON.parse(val || '{}')
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return '{}'

    const out: Record<string, number> = {}
    const now = Date.now()
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!set.has(key)) continue
      if (typeof value === 'number' && Number.isFinite(value)) {
        out[key] = value
      } else {
        // Non-number means: "stamp this key server-side"
        out[key] = now
      }
    }
    return JSON.stringify(out)
  } catch {
    return '{}'
  }
})
