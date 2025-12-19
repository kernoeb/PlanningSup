type CookieMap = Record<string, string>

const MIGRATION_VERSION = '1'
const MIGRATION_VERSION_STORAGE_KEY = 'settings.cookieMigrationVersion'

// Prefs meta is used by `useUserPrefsSync` (Last-Write-Wins).
const PREFS_META_STORAGE_KEY = 'userPrefsMeta'
type PrefKey = 'theme' | 'highlightTeacher' | 'showWeekends' | 'blocklist' | 'colors' | 'plannings' | 'mergeDuplicates' | 'customGroups'
type PrefsMeta = Partial<Record<PrefKey, number>>

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseCookies(cookieString: string): CookieMap {
  const out: CookieMap = {}
  if (!cookieString) return out

  // document.cookie uses "; " separators.
  const parts = cookieString.split(/;\s*/g)
  for (const part of parts) {
    if (!part) continue
    const eq = part.indexOf('=')
    const rawKey = eq >= 0 ? part.slice(0, eq) : part
    const rawVal = eq >= 0 ? part.slice(eq + 1) : ''
    const key = rawKey.trim()
    if (!key) continue
    out[key] = rawVal
  }
  return out
}

function getPrefsMeta(): PrefsMeta {
  try {
    const raw = localStorage.getItem(PREFS_META_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PrefsMeta) : {}
  } catch {
    return {}
  }
}

function setPrefsMeta(meta: PrefsMeta) {
  try {
    localStorage.setItem(PREFS_META_STORAGE_KEY, JSON.stringify(meta))
  } catch {}
}

function bumpMeta(keys: PrefKey[]) {
  const now = Date.now()
  const meta = getPrefsMeta()
  for (const key of keys) meta[key] = now
  setPrefsMeta(meta)
}

function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizePlanningIds(raw: string): string[] {
  const decoded = safeDecodeURIComponent(raw).trim()
  if (!decoded) return []

  // Accept old base64/JSON formats as a best-effort (legacy Nuxt had these).
  if (decoded.startsWith('[') && decoded.endsWith(']')) {
    const arr = tryParseJson<unknown[]>(decoded)
    if (Array.isArray(arr)) {
      return Array.from(new Set(arr.filter(x => typeof x === 'string').map(x => (x as string).trim()).filter(Boolean))).slice(0, 100)
    }
  }

  const parts = decoded.split(',').map(s => s.trim()).filter(Boolean)
  return Array.from(new Set(parts)).slice(0, 100)
}

function parseBooleanish(raw: string): boolean | null {
  const v = safeDecodeURIComponent(raw).trim().toLowerCase()
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}

function normalizeHexColor(raw: string): string | null {
  const v = safeDecodeURIComponent(raw).trim()
  if (!v) return null
  const withHash = v.startsWith('#') ? v : `#${v}`
  if (/^#[0-9a-f]{3}$/i.test(withHash)) {
    const r = withHash[1]
    const g = withHash[2]
    const b = withHash[3]
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  if (/^#[0-9a-f]{6}$/i.test(withHash)) return withHash.toUpperCase()
  return null
}

function deleteCookie(name: string) {
  try {
    // Best-effort. Domain cookies may not be removable from here without the domain attribute.
    document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  } catch {}
}

function hasOwnLocalStorageKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
  ])
}

interface PlanningsNode { title?: unknown, fullId?: unknown, children?: unknown }
function buildTitleByFullIdFromTree(nodes: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  const stack: unknown[] = Array.isArray(nodes) ? [...nodes] : []

  while (stack.length) {
    const item = stack.pop()
    if (!item || typeof item !== 'object') continue
    const n = item as PlanningsNode
    const fullId = typeof n.fullId === 'string' ? n.fullId : null
    const title = typeof n.title === 'string' ? n.title : null
    if (fullId && title) out[fullId] = title
    if (Array.isArray(n.children)) {
      for (const c of n.children) stack.push(c)
    }
  }

  return out
}

async function fetchPlanningTitleMap(): Promise<Record<string, string>> {
  if (typeof fetch !== 'function') return {}
  const base = import.meta.env?.VITE_BACKEND_URL || window.location.origin
  const url = new URL('/api/plannings', base)
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' },
  })
  if (!res.ok) return {}
  const data = await res.json()
  return buildTitleByFullIdFromTree(data)
}

async function migrateLegacyCookiesToLocalStorage() {
  const cookies = parseCookies(document.cookie || '')
  const migratedCookieNames: string[] = []
  const bumpedKeys: PrefKey[] = []

  // 1) plannings -> localStorage 'plannings' (JSON array)
  if (!hasOwnLocalStorageKey('plannings') && typeof cookies.plannings === 'string') {
    const ids = normalizePlanningIds(cookies.plannings)
    if (ids.length > 0) {
      if (safeSetLocalStorage('plannings', JSON.stringify(ids))) {
        bumpedKeys.push('plannings')
        migratedCookieNames.push('plannings', 'plannings-cookie-v2')
      }
    }
  }

  // 2) timezone -> settings.targetTimezone
  if (!hasOwnLocalStorageKey('settings.targetTimezone') && typeof cookies.timezone === 'string') {
    const tz = safeDecodeURIComponent(cookies.timezone).trim()
    if (tz) {
      // Stored as a raw string (no JSON quotes). See serializer in useSettings().
      if (safeSetLocalStorage('settings.targetTimezone', tz)) {
        migratedCookieNames.push('timezone')
      }
    }
  }

  // 3) blocklist -> settings.blocklist (JSON array)
  if (!hasOwnLocalStorageKey('settings.blocklist') && typeof cookies.blocklist === 'string') {
    const parsed = tryParseJson<unknown[]>(safeDecodeURIComponent(cookies.blocklist))
    const list = Array.isArray(parsed)
      ? parsed.filter(x => typeof x === 'string').map(x => (x as string).trim()).filter(Boolean)
      : []
    if (list.length > 0) {
      if (safeSetLocalStorage('settings.blocklist', JSON.stringify(list))) {
        bumpedKeys.push('blocklist')
        migratedCookieNames.push('blocklist')
      }
    }
  }

  // 4) mergeDuplicates -> settings.mergeDuplicates
  if (!hasOwnLocalStorageKey('settings.mergeDuplicates') && typeof cookies.mergeDuplicates === 'string') {
    const b = parseBooleanish(cookies.mergeDuplicates)
    if (typeof b === 'boolean') {
      if (safeSetLocalStorage('settings.mergeDuplicates', JSON.stringify(b))) {
        bumpedKeys.push('mergeDuplicates')
        migratedCookieNames.push('mergeDuplicates')
      }
    }
  }

  // 5) highlightTeacher -> settings.highlightTeacher
  if (!hasOwnLocalStorageKey('settings.highlightTeacher') && typeof cookies.highlightTeacher === 'string') {
    const b = parseBooleanish(cookies.highlightTeacher)
    if (typeof b === 'boolean') {
      if (safeSetLocalStorage('settings.highlightTeacher', JSON.stringify(b))) {
        bumpedKeys.push('highlightTeacher')
        migratedCookieNames.push('highlightTeacher')
      }
    }
  }

  // 6) theme (legacy vuetify dark boolean) -> settings.theme (string)
  if (!hasOwnLocalStorageKey('settings.theme') && typeof cookies.theme === 'string') {
    const b = parseBooleanish(cookies.theme)
    if (typeof b === 'boolean') {
      const mapped = b ? 'dark' : 'light'
      if (safeSetLocalStorage('settings.theme', mapped)) {
        bumpedKeys.push('theme')
        migratedCookieNames.push('theme')
      }
    }
  }

  // 7) customColorList -> settings.colors (object with new keys)
  if (!hasOwnLocalStorageKey('settings.colors') && typeof cookies.customColorList === 'string') {
    const parsed = tryParseJson<Record<string, unknown>>(safeDecodeURIComponent(cookies.customColorList))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const legacy = parsed as Record<string, unknown>
      const mapped: Record<string, string> = {}

      // Legacy: { amphi, tp, td, other } -> New: { lecture, lab, tutorial, other }
      const amphi = typeof legacy.amphi === 'string' ? normalizeHexColor(legacy.amphi) : null
      const tp = typeof legacy.tp === 'string' ? normalizeHexColor(legacy.tp) : null
      const td = typeof legacy.td === 'string' ? normalizeHexColor(legacy.td) : null
      const other = typeof legacy.other === 'string' ? normalizeHexColor(legacy.other) : null

      if (amphi) mapped.lecture = amphi
      if (tp) mapped.lab = tp
      if (td) mapped.tutorial = td
      if (other) mapped.other = other

      if (Object.keys(mapped).length > 0) {
        if (safeSetLocalStorage('settings.colors', JSON.stringify(mapped))) {
          bumpedKeys.push('colors')
          migratedCookieNames.push('customColorList')
        }
      }
    }
  }

  // 8) group-favorites -> settings.customGroups
  const customGroups: Array<{ id: string, name: string, plannings: string[] }> = []

  if (typeof cookies['group-favorites'] === 'string') {
    const parsed = tryParseJson<unknown[]>(safeDecodeURIComponent(cookies['group-favorites']))
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const name = typeof obj.name === 'string' ? obj.name.trim() : ''
        const plannings = Array.isArray(obj.plannings)
          ? obj.plannings.filter(x => typeof x === 'string').map(x => (x as string).trim()).filter(Boolean)
          : []
        if (!name || plannings.length === 0) continue
        customGroups.push({ id: crypto.randomUUID(), name, plannings: Array.from(new Set(plannings)).slice(0, 100) })
        if (customGroups.length >= 50) break
      }
    }
  }

  // 9) favorites -> one custom group per favorite (named by planning title when possible)
  const favoriteFullIds: string[] = []
  const favoriteLabelById = new Map<string, string>()
  if (typeof cookies.favorites === 'string') {
    const raw = safeDecodeURIComponent(cookies.favorites)
    const parsed = tryParseJson<unknown>(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [fullIdRaw, labelRaw] of Object.entries(parsed as Record<string, unknown>)) {
        const fullId = String(fullIdRaw ?? '').trim()
        if (!fullId) continue
        favoriteFullIds.push(fullId)
        if (typeof labelRaw === 'string') {
          const label = labelRaw.trim()
          if (label) favoriteLabelById.set(fullId, label)
        }
        if (favoriteFullIds.length >= 100) break
      }
    } else {
      // Very old format: "a,b,c"
      const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
      const norm = Array.from(new Set(ids)).slice(0, 100)
      for (const id of norm) {
        favoriteFullIds.push(id)
      }
    }
  }

  if (favoriteFullIds.length > 0) {
    const unique = Array.from(new Set(favoriteFullIds)).slice(0, 100)

    // Best-effort title lookup (so groups show up with the actual planning title).
    // If it fails (offline, network error), fall back to cookie-provided label or fullId.
    let titleById: Record<string, string> = {}
    try {
      titleById = await withTimeout(fetchPlanningTitleMap(), 1500)
    } catch {}

    for (const fullId of unique) {
      const title = titleById[fullId]
      const fallback = favoriteLabelById.get(fullId) || fullId
      customGroups.push({
        id: crypto.randomUUID(),
        name: (title || fallback).trim(),
        plannings: [fullId],
      })
      if (customGroups.length >= 50) break
    }
  }

  // Write customGroups only if the new storage key is not already set.
  if (!hasOwnLocalStorageKey('settings.customGroups') && customGroups.length > 0) {
    if (safeSetLocalStorage('settings.customGroups', JSON.stringify(customGroups))) {
      bumpedKeys.push('customGroups')
      if (cookies['group-favorites'] !== undefined) migratedCookieNames.push('group-favorites')
      if (cookies.favorites !== undefined) migratedCookieNames.push('favorites')
    }
  }

  // Stamp meta for keys that will sync to server on login.
  if (bumpedKeys.length > 0) bumpMeta(bumpedKeys)

  // Persist migration marker even if nothing migrated, to avoid re-running on every load.
  try {
    localStorage.setItem(MIGRATION_VERSION_STORAGE_KEY, MIGRATION_VERSION)
  } catch {}

  // Best-effort cleanup of legacy cookies we consumed.
  for (const name of new Set(migratedCookieNames)) {
    deleteCookie(name)
  }
}

/**
 * One-time browser-only migration:
 * - Reads legacy cookies from the old Nuxt app (apps/web-app)
 * - Writes equivalent values into the new localStorage-based settings (apps/web)
 * - Stamps userPrefsMeta for keys that are server-synced (so local wins on next login)
 *
 * This should run before the Vue app mounts, so composables (theme, settings, plannings)
 * see migrated values on first render.
 */
export async function runCookieMigrationOnce() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  try {
    const existingVersion = localStorage.getItem(MIGRATION_VERSION_STORAGE_KEY)
    if (existingVersion === MIGRATION_VERSION) return
  } catch {
    return
  }

  try {
    await migrateLegacyCookiesToLocalStorage()
  } catch (err) {
    console.warn('[cookie-migration] Unexpected error (skipping migration):', err)
  }
}
