import { describe, expect, it } from 'bun:test'
import { runTimezoneWorkaroundMigrationOnce, shouldResetTimezoneWorkaround } from '@web/utils/timezone-workaround-migration'

class MemoryStorage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(i: number) { return [...this.data.keys()][i] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

const nantes = ['iut-de-nantes.cca1.g2311809']

describe('shouldResetTimezoneWorkaround', () => {
  it('resets a UTC target for a Paris browser with a Nantes planning', () => {
    expect(shouldResetTimezoneWorkaround('UTC', 'Europe/Paris', nantes)).toBeTrue()
    expect(shouldResetTimezoneWorkaround('Etc/GMT', 'Europe/Paris', nantes)).toBeTrue()
    expect(shouldResetTimezoneWorkaround('Africa/Abidjan', 'Europe/Paris', ['iae-de-nantes.x'])).toBeTrue()
  })

  it('keeps every other setup', () => {
    expect(shouldResetTimezoneWorkaround(null, 'Europe/Paris', nantes)).toBeFalse()
    expect(shouldResetTimezoneWorkaround('America/New_York', 'Europe/Paris', nantes)).toBeFalse()
    expect(shouldResetTimezoneWorkaround('Europe/London', 'Europe/Paris', nantes)).toBeFalse()
    expect(shouldResetTimezoneWorkaround('UTC', 'UTC', nantes)).toBeFalse()
    expect(shouldResetTimezoneWorkaround('UTC', 'Europe/Paris', ['insa-rennes.ma.s5-ma'])).toBeFalse()
  })
})

describe('runTimezoneWorkaroundMigrationOnce', () => {
  it('runs once and only touches the target timezone', () => {
    const storage = new MemoryStorage()
    storage.setItem('settings.targetTimezone', 'UTC')
    storage.setItem('plannings', JSON.stringify(nantes))
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone
    const originalResolved = Intl.DateTimeFormat.prototype.resolvedOptions
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      return { ...originalResolved.call(this), timeZone: 'Europe/Paris' }
    }
    try {
      runTimezoneWorkaroundMigrationOnce(storage as unknown as Storage)
      expect(storage.getItem('settings.targetTimezone')).toBeNull()
      expect(storage.getItem('plannings')).toBe(JSON.stringify(nantes))

      storage.setItem('settings.targetTimezone', 'UTC')
      runTimezoneWorkaroundMigrationOnce(storage as unknown as Storage)
      expect(storage.getItem('settings.targetTimezone')).toBe('UTC')
    } finally {
      Intl.DateTimeFormat.prototype.resolvedOptions = originalResolved
    }
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(browser)
  })
})
