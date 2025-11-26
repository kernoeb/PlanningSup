import type { EventWithFullId } from '@web/composables/usePlanningData'

function toEpochMs(value: EventWithFullId['startDate']): number {
  if (value instanceof Date) return value.getTime()
  if (value && typeof (value as any).epochMilliseconds === 'number') return (value as any).epochMilliseconds
  if (value && typeof (value as any).toTemporalInstant === 'function') {
    try {
      return (value as any).toTemporalInstant().epochMilliseconds
    } catch {}
  }
  const asNumber = typeof value === 'number' ? value : Number.NaN
  if (Number.isFinite(asNumber)) return asNumber
  const parsed = new Date(value as any).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeText(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

function buildEventKey(event: EventWithFullId): string {
  const start = toEpochMs(event.startDate)
  const end = toEpochMs(event.endDate)
  const summary = normalizeText(event.summary)
  const location = normalizeText(event.location)
  const category = normalizeText(event.categoryId)
  return `${start}|${end}|${summary}|${location}|${category}`
}

/**
 * Merge duplicate events (same time window, summary, location, and category).
 * Runs in O(n) with a single pass + Map to keep the first occurrence order.
 */
export function mergeDuplicateEvents<T extends EventWithFullId>(events: readonly T[]): T[] {
  if (!events || events.length <= 1) return events as T[]

  const seen = new Set<string>()
  const deduped: T[] = []

  for (const event of events) {
    const key = buildEventKey(event)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(event)
  }

  return deduped
}
