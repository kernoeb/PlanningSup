import { mock } from 'bun:test'

type CalEvent = {
  uid: string
  summary: string
  startDate: Date
  endDate: Date
  location: string
  description: string
}

type BackupRecord = { events: CalEvent[], updatedAt: Date }
type RefreshStateRecord = { lastSuccessAt: Date }

type ApiDbMockState = {
  backupStore: Record<string, BackupRecord | undefined>
  refreshStateStore: Record<string, RefreshStateRecord | undefined>
  refreshQueueStore: Map<string, { priority: number }>
  opsSelectRowsByCall: any[][]
  opsSelectCallIndex: number
}

const STATE_KEY = '__planningsup_api_db_mock_state__'
const INSTALLED_KEY = '__planningsup_api_db_mock_installed__'

function getState(): ApiDbMockState {
  const g = globalThis as any
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = {
      backupStore: {},
      refreshStateStore: {},
      refreshQueueStore: new Map(),
      opsSelectRowsByCall: [],
      opsSelectCallIndex: 0,
    } satisfies ApiDbMockState
  }
  return g[STATE_KEY] as ApiDbMockState
}

function extractEqStringValue(where: any): string | null {
  const chunks = where?.queryChunks
  if (!Array.isArray(chunks)) return null
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') continue
    if (chunk.constructor?.name === 'Param' && typeof (chunk as any).value === 'string') {
      return (chunk as any).value as string
    }
  }
  return null
}

export function configureApiDbMock(config: Partial<Pick<ApiDbMockState, 'opsSelectRowsByCall'>>) {
  const state = getState()
  if (config.opsSelectRowsByCall) state.opsSelectRowsByCall = config.opsSelectRowsByCall
  state.opsSelectCallIndex = 0
}

export function resetApiDbMockStores() {
  const state = getState()
  for (const key of Object.keys(state.backupStore)) delete state.backupStore[key]
  for (const key of Object.keys(state.refreshStateStore)) delete state.refreshStateStore[key]
  state.refreshQueueStore.clear()
  state.opsSelectRowsByCall = []
  state.opsSelectCallIndex = 0
}

export function getApiDbMockStores() {
  const state = getState()
  return {
    backupStore: state.backupStore,
    refreshStateStore: state.refreshStateStore,
    refreshQueueStore: state.refreshQueueStore,
  }
}

export function installApiDbMock() {
  const g = globalThis as any
  if (g[INSTALLED_KEY]) return
  g[INSTALLED_KEY] = true

  mock.module('@api/db', () => {
    const state = getState()

    function insertBuilder(values: any) {
      // Use explicit object to avoid `this` binding issues with Bun's mock
      const builder = {
        _values: values,
        onConflictDoUpdate(_cfg: any) {
          return builder
        },
        async returning() {
          // plannings backup upsert
          if (builder._values && 'planningFullId' in builder._values && 'events' in builder._values) {
            const fullId = builder._values.planningFullId as string
            const nextEvents = builder._values.events as CalEvent[]
            const prev = state.backupStore[fullId]?.events
            const changed = JSON.stringify(prev ?? null) !== JSON.stringify(nextEvents)
            state.backupStore[fullId] = { events: nextEvents, updatedAt: new Date() }
            return changed ? [{ planningFullId: fullId }] : []
          }

          return []
        },
        then(onFulfilled: any, onRejected: any) {
          return Promise.resolve([]).then(onFulfilled, onRejected)
        },
      }
      return builder
    }

    return {
      db: {
        select(_fields: any) {
          state.opsSelectCallIndex += 1
          const rows = state.opsSelectRowsByCall[state.opsSelectCallIndex - 1] ?? []

          const builder = {
            from() {
              return this
            },
            leftJoin() {
              return this
            },
            where() {
              return this
            },
            groupBy() {
              return this
            },
            orderBy() {
              return this
            },
            limit() {
              return this
            },
            then(onFulfilled: any, onRejected: any) {
              return Promise.resolve(rows).then(onFulfilled, onRejected)
            },
          }

          return builder as any
        },
        insert(_table: any) {
          return {
            values(values: any) {
              // plannings refresh queue upsert (best-effort)
              if (values && 'planningFullId' in values && 'priority' in values && !('events' in values)) {
                const fullId = values.planningFullId as string
                state.refreshQueueStore.set(fullId, { priority: values.priority as number })
              }

              // plannings refresh state upsert (best-effort)
              if (values && 'planningFullId' in values && ('lastSuccessAt' in values || 'lastAttemptAt' in values) && !('events' in values) && !('priority' in values)) {
                const fullId = values.planningFullId as string
                state.refreshStateStore[fullId] = { lastSuccessAt: new Date() }
              }
              return insertBuilder(values)
            },
          }
        },
        query: {
          planningsBackupTable: {
            async findFirst(args: any) {
              const id = extractEqStringValue(args?.where)
              if (!id) return undefined
              const record = state.backupStore[id]
              if (!record) return undefined
              return { events: record.events, updatedAt: record.updatedAt }
            },
          },
          planningsRefreshStateTable: {
            async findFirst(args: any) {
              const id = extractEqStringValue(args?.where)
              if (!id) return undefined
              const record = state.refreshStateStore[id]
              if (!record) return undefined
              return { lastSuccessAt: record.lastSuccessAt }
            },
          },
        },
      },
    }
  })
}
