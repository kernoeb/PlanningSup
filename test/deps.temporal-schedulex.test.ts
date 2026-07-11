/**
 * Dependency-alignment guard: temporal-polyfill × Schedule X.
 *
 * Schedule X validates every event's start/end with `instanceof Temporal.*`. If the
 * app creates events with a *different* temporal-polyfill implementation than the
 * one Schedule X checks against, every event is silently rejected and the calendar
 * renders nothing. This bit us when the app was bumped to temporal-polyfill 1.x
 * while @schedule-x pins 0.3.x — 1.x "uses native Temporal when available", which in
 * browsers with a partial native Temporal (real Chrome) splits Temporal identity and
 * breaks rendering.
 *
 * Crucially, that failure only reproduces in some browsers, so the e2e test cannot
 * reliably catch it. This unit test guards the ROOT CAUSE deterministically: the app
 * and Schedule X must use one aligned temporal-polyfill. Keep temporal-polyfill on
 * whatever major.minor @schedule-x pins until Schedule X itself moves forward.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const readJson = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

// @schedule-x/calendar is a dep of apps/web (not hoisted to the root node_modules),
// so read its manifest straight from bun's content-addressed store.
function readScheduleXManifest() {
  const bunDir = join(ROOT, 'node_modules/.bun')
  const dir = readdirSync(bunDir).find(d => d.startsWith('@schedule-x+calendar@'))
  if (!dir) throw new Error('@schedule-x/calendar not found in node_modules/.bun')
  return JSON.parse(readFileSync(join(bunDir, dir, 'node_modules/@schedule-x/calendar/package.json'), 'utf8'))
}

// For 0.x, the minor is the breaking boundary (semver caret treats 0.3.x as one
// line); for >=1.x the major is. So compare "compat keys": 0.3.2 -> "0.3", 1.0.1 -> "1".
function compatKey(version: string): string {
  const [maj, min] = version.replace(/^[^\d]*/, '').split('.')
  return maj === '0' ? `0.${min}` : String(maj)
}

const scheduleXManifest = readScheduleXManifest()
const scheduleXReq = (scheduleXManifest.peerDependencies?.['temporal-polyfill']
  ?? scheduleXManifest.dependencies?.['temporal-polyfill']) as string
const webDecl = readJson('apps/web/package.json').dependencies['temporal-polyfill'] as string
const appDecl = readJson('apps/app/package.json').dependencies['temporal-polyfill'] as string
const override = readJson('package.json').overrides['temporal-polyfill'] as string

describe('temporal-polyfill alignment with @schedule-x', () => {
  it('the apps declare a temporal-polyfill compatible with what @schedule-x pins', () => {
    const target = compatKey(scheduleXReq)
    expect(compatKey(webDecl)).toBe(target)
    expect(compatKey(appDecl)).toBe(target)
  })

  it('the root override pins temporal-polyfill to that same line (so the whole tree dedupes)', () => {
    expect(compatKey(override)).toBe(compatKey(scheduleXReq))
  })

  it('exactly one temporal-polyfill version is installed (no split implementation at runtime)', () => {
    const bunDir = join(ROOT, 'node_modules/.bun')
    const installed = readdirSync(bunDir)
      .filter(d => d.startsWith('temporal-polyfill@'))
      .map(d => d.replace('temporal-polyfill@', '').split('+')[0]!)
    expect(installed.length).toBeGreaterThan(0)
    const keys = [...new Set(installed.map(compatKey))]
    expect(keys, `installed temporal-polyfill versions: ${installed.join(', ')}`).toHaveLength(1)
    expect(keys[0]).toBe(compatKey(scheduleXReq))
  })
})
