import { describe, expect, it } from 'bun:test'
import { computePlanningLanes, laneClassName, laneStyleSheet } from '@web/utils/planning-lanes'

const H = 60 * 60 * 1000

describe('computePlanningLanes', () => {
  it('does nothing with a single planning', () => {
    const positions = computePlanningLanes([{ id: 'a', start: 0, end: H, lanes: [0] }], 1, 100)
    expect(positions.size).toBe(0)
  })

  it('keeps a lone course in the lane of its planning', () => {
    const positions = computePlanningLanes([{ id: 'a', start: 0, end: H, lanes: [1] }], 2, 100)
    expect(positions.get('a')).toEqual({ left: 50, width: 50 })
  })

  it('splits a lane when 2 courses of one planning overlap', () => {
    const positions = computePlanningLanes([
      { id: 'a', start: 0, end: 2 * H, lanes: [0] },
      { id: 'b', start: H, end: 3 * H, lanes: [0] },
      { id: 'c', start: 0, end: H, lanes: [1] },
    ], 2, 100)
    expect(positions.get('a')).toEqual({ left: 0, width: 25 })
    expect(positions.get('b')).toEqual({ left: 25, width: 25 })
    expect(positions.get('c')).toEqual({ left: 50, width: 50 })
  })

  it('starts a new cluster once the previous courses are over', () => {
    const positions = computePlanningLanes([
      { id: 'a', start: 0, end: 2 * H, lanes: [0] },
      { id: 'b', start: H, end: 2 * H, lanes: [0] },
      { id: 'c', start: 2 * H, end: 3 * H, lanes: [0] },
    ], 2, 100)
    expect(positions.get('c')).toEqual({ left: 0, width: 50 })
  })

  it('spans next-door lanes for a shared course', () => {
    const positions = computePlanningLanes([{ id: 'a', start: 0, end: H, lanes: [1, 2] }], 3, 99)
    expect(positions.get('a')).toEqual({ left: 33, width: 66 })
  })

  it('keeps a shared course in its first lane when the lanes are not next to each other', () => {
    const positions = computePlanningLanes([{ id: 'a', start: 0, end: H, lanes: [2, 0] }], 3, 99)
    expect(positions.get('a')).toEqual({ left: 0, width: 33 })
  })

  it('shrinks a shared course that would cover another course', () => {
    const positions = computePlanningLanes([
      { id: 'shared', start: 0, end: 2 * H, lanes: [0, 1] },
      { id: 'other', start: H, end: 3 * H, lanes: [1] },
    ], 2, 100)
    expect(positions.get('shared')).toEqual({ left: 0, width: 50 })
    expect(positions.get('other')).toEqual({ left: 50, width: 50 })
  })
})

describe('laneStyleSheet', () => {
  it('writes one rule per position', () => {
    const p = { left: 32.67, width: 32.67 }
    expect(laneClassName(p)).toBe('sx-lane-32_67-32_67')
    const css = laneStyleSheet([p, { ...p }])
    expect(css).toBe('.sx__time-grid-event.sx-lane-32_67-32_67{inset-inline-start:32.67% !important;width:32.67% !important}')
  })

  it('scales positions to the event width', () => {
    const css = laneStyleSheet([{ left: 50, width: 50 }], 98)
    expect(css).toBe('.sx__time-grid-event.sx-lane-50-50{inset-inline-start:49% !important;width:49% !important}')
  })
})
