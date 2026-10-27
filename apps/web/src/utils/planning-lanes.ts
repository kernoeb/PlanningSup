export interface LaneItem {
  id: string
  start: number
  end: number
  /** Indexes of the selected plannings that hold this event. */
  lanes: readonly number[]
}

/** Horizontal position inside a day column, in percent. */
export interface LanePosition {
  left: number
  width: number
}

interface RangedItem extends LaneItem {
  from: number
  to: number
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Give each planning a fixed column ("lane") in the day, even when the other plannings are free.
 * A course shared by next-door lanes spans them all; overlapping courses split their lane.
 */
export function computePlanningLanes(items: readonly LaneItem[], laneCount: number, totalWidth: number): Map<string, LanePosition> {
  const positions = new Map<string, LanePosition>()
  if (laneCount < 2) return positions
  const laneWidth = totalWidth / laneCount

  const ranged: RangedItem[] = []
  for (const item of items) {
    const lanes = [...new Set(item.lanes)].filter(l => l >= 0 && l < laneCount).sort((a, b) => a - b)
    if (lanes.length === 0) continue
    const from = lanes[0]!
    const last = lanes.at(-1)!
    // A gap would draw the course over a planning that does not have it.
    const to = last - from + 1 === lanes.length ? last : from
    ranged.push({ ...item, from, to })
  }
  ranged.sort((a, b) => a.start - b.start || b.end - a.end)

  // A spanning course falls back to its first lane when it would cover another course.
  const active: RangedItem[] = []
  const shrunk = new Set<RangedItem>()
  for (const item of ranged) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i]!.end <= item.start) active.splice(i, 1)
    }
    for (const other of active) {
      if (other.from > item.to || other.to < item.from) continue
      if (item.to > item.from) shrunk.add(item)
      if (other.to > other.from) shrunk.add(other)
    }
    active.push(item)
  }
  for (const item of shrunk) item.to = item.from

  const byLane = new Map<number, RangedItem[]>()
  for (const item of ranged) {
    if (item.to > item.from) {
      positions.set(item.id, { left: round(item.from * laneWidth), width: round((item.to - item.from + 1) * laneWidth) })
      continue
    }
    const list = byLane.get(item.from) ?? []
    list.push(item)
    byLane.set(item.from, list)
  }

  for (const [lane, list] of byLane) {
    let cluster: { item: RangedItem, column: number }[] = []
    let clusterEnd = -Infinity

    const flush = () => {
      const columns = Math.max(...cluster.map(c => c.column)) + 1
      for (const { item, column } of cluster) {
        positions.set(item.id, {
          left: round((lane + column / columns) * laneWidth),
          width: round(laneWidth / columns),
        })
      }
      cluster = []
    }

    for (const item of list) {
      if (cluster.length > 0 && item.start >= clusterEnd) flush()
      const taken = new Set(cluster.filter(c => c.item.end > item.start).map(c => c.column))
      let column = 0
      while (taken.has(column)) column++
      cluster.push({ item, column })
      clusterEnd = cluster.length === 1 ? item.end : Math.max(clusterEnd, item.end)
    }
    if (cluster.length > 0) flush()
  }

  return positions
}

export function laneClassName(position: LanePosition): string {
  return `sx-lane-${String(position.left).replace('.', '_')}-${String(position.width).replace('.', '_')}`
}

// `!important` beats the inline position Schedule X writes on each event.
// Positions use a 0-100 scale, which `totalWidth` (the calendar event width) shrinks.
export function laneStyleSheet(positions: Iterable<LanePosition>, totalWidth = 100): string {
  const rules = new Map<string, string>()
  for (const p of positions) {
    const name = laneClassName(p)
    if (rules.has(name)) continue
    const left = round(p.left * totalWidth / 100)
    const width = round(p.width * totalWidth / 100)
    rules.set(name, `.sx__time-grid-event.${name}{inset-inline-start:${left}% !important;width:${width}% !important}`)
  }
  return [...rules.values()].join('\n')
}
