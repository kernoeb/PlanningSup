export interface SortablePlanningEvent {
  fullId: string
  uid: string
  summary: string
  startDate: unknown
  endDate: unknown
  location: string
  description: string
  categoryId: string
}

function toEpochMs(value: unknown): number {
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

function cmpText(a: unknown, b: unknown): number {
  const aa = typeof a === 'string' ? a : `${a ?? ''}`
  const bb = typeof b === 'string' ? b : `${b ?? ''}`
  if (aa === bb) return 0
  return aa.localeCompare(bb, 'fr-FR')
}

export function createPlanningEventComparator<T extends SortablePlanningEvent>(planningOrder: readonly string[]) {
  const indexByFullId = new Map<string, number>()
  planningOrder.forEach((id, i) => indexByFullId.set(id, i))

  return (a: T, b: T) => {
    const startDiff = toEpochMs(a.startDate) - toEpochMs(b.startDate)
    if (startDiff !== 0) return startDiff

    const endDiff = toEpochMs(a.endDate) - toEpochMs(b.endDate)
    if (endDiff !== 0) return endDiff

    const aIndex = indexByFullId.get(a.fullId) ?? Number.MAX_SAFE_INTEGER
    const bIndex = indexByFullId.get(b.fullId) ?? Number.MAX_SAFE_INTEGER
    if (aIndex !== bIndex) return aIndex - bIndex

    const uidDiff = cmpText(a.uid, b.uid)
    if (uidDiff !== 0) return uidDiff

    const summaryDiff = cmpText(a.summary, b.summary)
    if (summaryDiff !== 0) return summaryDiff

    const locationDiff = cmpText(a.location, b.location)
    if (locationDiff !== 0) return locationDiff

    const categoryDiff = cmpText(a.categoryId, b.categoryId)
    if (categoryDiff !== 0) return categoryDiff

    return cmpText(a.description, b.description)
  }
}

export function sortPlanningEventsDeterministically<T extends SortablePlanningEvent>(
  events: readonly T[],
  planningOrder: readonly string[],
): T[] {
  if (!events || events.length <= 1) return events as T[]

  return [...events].sort(createPlanningEventComparator(planningOrder))
}

export function mergeSortedPlanningEventsDeterministically<T extends SortablePlanningEvent>(
  eventsByFullId: Readonly<Record<string, readonly T[]>>,
  planningOrder: readonly string[],
): T[] {
  const lists = planningOrder.map(fullId => eventsByFullId[fullId] ?? [])
  const indices = lists.map(() => 0)
  const total = lists.reduce((sum, list) => sum + list.length, 0)
  if (total <= 1) {
    if (total === 1) {
      for (const list of lists) {
        const first = list[0] as T | undefined
        if (first) return [first]
      }
    }
    return []
  }

  const cmp = createPlanningEventComparator<T>(planningOrder)
  const out: T[] = []
  out.length = 0

  while (out.length < total) {
    let bestListIndex = -1
    let bestEvent: T | undefined

    for (let i = 0; i < lists.length; i++) {
      const idx = indices[i]!
      const candidate = lists[i]![idx] as T | undefined
      if (!candidate) continue

      if (!bestEvent || cmp(candidate, bestEvent) < 0) {
        bestEvent = candidate
        bestListIndex = i
      }
    }

    if (bestListIndex === -1 || !bestEvent) break
    out.push(bestEvent)
    indices[bestListIndex] = (indices[bestListIndex] ?? 0) + 1
  }

  return out
}
